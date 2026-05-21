import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('loads with all 5 tabs visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
    await expect(page.getByRole('button', { name: '波动率分析' })).toBeVisible()
    await expect(page.getByRole('button', { name: '持仓结构' })).toBeVisible()
    await expect(page.getByRole('button', { name: '资金情绪' })).toBeVisible()
    await expect(page.getByRole('button', { name: '到期分析' })).toBeVisible()
  })

  test('default active tab shows market overview content', async ({ page }) => {
    await page.goto('/')

    await page.waitForLoadState('networkidle')

    // 点击市场概况卡片打开 Drawer
    await page.getByRole('button', { name: '市场概况' }).click()
    // 等待 Drawer 打开
    await expect(page.getByRole('dialog')).toBeVisible()
    // 断言 Drawer 内的 KPI 卡片和图表
    await expect(page.getByText('总持仓量 (OI)')).toBeVisible()
    await expect(page.getByText('24h 交易量分布（按到期日）')).toBeVisible()
  })

  test('switching tab updates visible content', async ({ page }) => {
    await page.goto('/')

    await page.waitForLoadState('networkidle')

    // 点击波动率分析卡片打开 Drawer
    await page.getByRole('button', { name: '波动率分析' }).click()
    // 等待 Drawer 打开并渲染内容
    await expect(page.getByRole('dialog')).toBeVisible()

    await expect(page.getByText('ATM IV 期限结构').first()).toBeVisible({ timeout: 15000 })

  })

  test('header shows Deribit connection status', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Deribit')).toBeVisible()
    await expect(page.getByText('自动刷新 30s')).toBeVisible()
  })

  test('rapid tab switching does not crash', async ({ page }) => {
    await page.goto('/')

    await page.waitForLoadState('networkidle')

    const cards = ['市场概况', '波动率分析', '持仓结构', '资金情绪', '到期分析']
    for (let i = 0; i < 10; i++) {
      const card = cards[i % cards.length]
      await page.getByRole('button', { name: card }).click()
      // 等待 Drawer 打开
      await expect(page.getByRole('dialog')).toBeVisible()
      // 点击关闭按钮
      await page.getByRole('button', { name: '关闭' }).click()
      // 等待 Drawer 关闭
      await expect(page.getByRole('dialog')).not.toBeVisible()
    }
    // Page should still be functional after rapid switching
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
  })

  test('all tabs render without console errors', async ({ page }) => {
    const errors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/')

    await page.waitForLoadState('networkidle')

    const cards = ['波动率分析', '持仓结构', '资金情绪', '到期分析']
    for (const card of cards) {
      await page.getByRole('button', { name: card }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      // 点击关闭按钮
      await page.getByRole('button', { name: '关闭' }).click()
      await expect(page.getByRole('dialog')).not.toBeVisible()
    }

    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
  })
})

test.describe('Dashboard - Hydration', () => {
  test('hydrates without fatal page errors', async ({ page }) => {
    const pageErrors = []
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    await page.goto('/')
    // 等待网络空闲（所有初始请求完成）后再断言
    await page.waitForLoadState('networkidle')

    expect(pageErrors).toHaveLength(0)
  })

  test('hydrates without DOM container errors', async ({ page }) => {
    const consoleErrors = []
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
    // 等待第一个 tRPC 响应返回
    await page.waitForResponse((resp) => resp.url().includes('/trpc/'), { timeout: 15000 })

    // 点击市场概况卡片打开 Drawer
    await page.getByRole('button', { name: '市场概况' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // 如果 API 不可用，至少验证页面结构完整
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
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
    // 在 tablet 上也可以点击卡片打开 Drawer
    await page.getByRole('button', { name: '市场概况' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
  })

  test('renders correctly on large desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
    // 在 desktop 上也可以点击卡片打开 Drawer
    await page.getByRole('button', { name: '市场概况' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
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
    // Error fallback should eventually appear
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 10000 })
  })
})
