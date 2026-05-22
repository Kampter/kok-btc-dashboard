import { test, expect, type Page } from '@playwright/test'

async function openModule(page: Page, name: string) {
  await page.getByRole('button', { name }).click()
  // Wait for drawer animation
  await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 })
}

async function closeModule(page: Page) {
  const closeButton = page.getByRole('button', { name: '关闭' })
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click()
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 })
  }
}

test.describe('Dashboard', () => {
  test('loads with all module cards visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
    await expect(page.getByRole('button', { name: '波动率分析' })).toBeVisible()
    await expect(page.getByRole('button', { name: '持仓结构' })).toBeVisible()
    await expect(page.getByRole('button', { name: '资金情绪' })).toBeVisible()
    await expect(page.getByRole('button', { name: '到期分析' })).toBeVisible()
  })

  test('market overview card opens drawer with detail content', async ({ page }) => {
    await page.goto('/')
    await openModule(page, '市场概况')
    await expect(page.getByText('总持仓量 (OI)')).toBeVisible()
    await expect(page.getByText('24h 交易量分布（按到期日）')).toBeVisible()
  })

  test('switching module updates drawer content', async ({ page }) => {
    await page.goto('/')
    // Open market overview
    await openModule(page, '市场概况')
    await expect(page.getByText('24h 交易量分布（按到期日）')).toBeVisible()

    // Close and switch to volatility
    await closeModule(page)
    await openModule(page, '波动率分析')
    // Wait for loading skeleton to disappear
    await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 10000 })
    await expect(page.getByText('ATM IV 期限结构')).toBeVisible({ timeout: 10000 })
  })

  test('header shows Deribit connection status', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Deribit')).toBeVisible()
    await expect(page.getByText('自动刷新 30s')).toBeVisible()
  })

  test('rapid module switching does not crash', async ({ page }) => {
    await page.goto('/')
    const modules = ['波动率分析', '持仓结构', '资金情绪', '到期分析', '市场概况']
    for (let i = 0; i < 10; i++) {
      const mod = modules[i % modules.length]
      await closeModule(page)
      await openModule(page, mod)
      // Brief wait for content to render
      await page.waitForTimeout(200)
    }
    await closeModule(page)
    // Page should still be functional
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
  })

  test('all modules render without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/')
    const modules = ['波动率分析', '持仓结构', '资金情绪', '到期分析']
    for (const mod of modules) {
      await openModule(page, mod)
      // Wait for loading skeleton to disappear before closing
      await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 10000 })
      await closeModule(page)
    }

    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
  })
})

test.describe('Dashboard - Hydration', () => {
  test('hydrates without fatal page errors', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    expect(pageErrors).toHaveLength(0)
  })

  test('hydrates without DOM container errors', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const hydrationErrors = consoleErrors.filter(
      (e) =>
        e.includes('Target container') ||
        e.includes('hydrat') ||
        e.includes('Hydration'),
    )
    expect(hydrationErrors).toHaveLength(0)
  })

  test('loads real data after hydration (not all zeros)', async ({ page }) => {
    await page.goto('/')
    // Wait for tRPC response
    await page.waitForResponse((resp) => resp.url().includes('/trpc/'), { timeout: 15000 })

    // Check overview grid shows non-zero data
    const btcPrice = await page.getByText(/\$[\d,.]+B/).first()
    const hasNonZeroData = await btcPrice.isVisible().catch(() => false)
    expect(hasNonZeroData).toBe(true)

    // Open drawer to verify detailed content
    await openModule(page, '市场概况')
    await expect(page.getByText('BTC 现货价格')).toBeVisible()
    await expect(page.getByText('总持仓量 (OI)')).toBeVisible()
  })
})

test.describe('Dashboard - Responsive', () => {
  test('renders correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
    await expect(page.getByText('BTC Options Dashboard')).toBeVisible()
  })

  test('renders correctly on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
    // Open drawer and verify content on tablet
    await openModule(page, '市场概况')
    await expect(page.getByText('总持仓量 (OI)')).toBeVisible()
  })

  test('renders correctly on large desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
    // Open drawer and verify content on desktop
    await openModule(page, '市场概况')
    await expect(page.getByText('总持仓量 (OI)')).toBeVisible()
  })
})

test.describe('Dashboard - Error States', () => {
  test('shows loading skeleton on initial load', async ({ page }) => {
    await page.goto('/')
    // Skeleton should be visible briefly before data loads
    await expect(page.locator('.animate-pulse').first()).toBeVisible()
  })

  test('retry button appears on error', async ({ page }) => {
    // Block API requests to simulate error
    await page.route('**/trpc/**', (route) => route.abort())
    await page.goto('/')
    // Error fallback should eventually appear in the drawer
    await openModule(page, '市场概况')
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 10000 })
  })
})
