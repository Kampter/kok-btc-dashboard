import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test('loads with all 5 tabs visible', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('tab', { name: '市场概况' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '波动率分析' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '持仓结构' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '资金情绪' })).toBeVisible()
    await expect(page.getByRole('tab', { name: '到期分析' })).toBeVisible()
  })

  test('default active tab shows market overview content', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('总持仓量 (OI)')).toBeVisible()
    await expect(page.getByText('24h 交易量分布（按到期日）')).toBeVisible()
  })

  test('switching tab updates visible content', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('tab', { name: '波动率分析' }).click()
    await expect(page.getByText('IV 期限结构')).toBeVisible()
    await expect(page.getByText('总持仓量 (OI)')).not.toBeVisible()
  })

  test('header shows Deribit connection status', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Deribit')).toBeVisible()
    await expect(page.getByText('自动刷新 30s')).toBeVisible()
  })

  test('rapid tab switching does not crash', async ({ page }) => {
    await page.goto('/')
    const tabs = ['波动率分析', '持仓结构', '资金情绪', '到期分析', '市场概况']
    for (let i = 0; i < 10; i++) {
      const tab = tabs[i % tabs.length]
      await page.getByRole('tab', { name: tab }).click()
    }
    // Page should still be functional after rapid switching
    await expect(page.getByRole('tab', { name: '市场概况' })).toBeVisible()
  })

  test('all tabs render without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/')
    const tabs = ['波动率分析', '持仓结构', '资金情绪', '到期分析']
    for (const tab of tabs) {
      await page.getByRole('tab', { name: tab }).click()
      await page.waitForTimeout(500)
    }

    expect(errors.filter((e) => !e.includes('favicon'))).toHaveLength(0)
  })
})

test.describe('Dashboard - Responsive', () => {
  test('renders correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.getByRole('tab', { name: '市场概况' })).toBeVisible()
    await expect(page.getByText('BTC Options Dashboard')).toBeVisible()
  })

  test('renders correctly on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    await expect(page.getByRole('tab', { name: '市场概况' })).toBeVisible()
    await expect(page.getByText('总持仓量 (OI)')).toBeVisible()
  })

  test('renders correctly on large desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await expect(page.getByRole('tab', { name: '市场概况' })).toBeVisible()
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
    // Error fallback should eventually appear
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 10000 })
  })
})
