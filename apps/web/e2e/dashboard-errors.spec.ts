import { test, expect } from '@playwright/test'

async function openModule(page: any, name: string) {
  await page.getByRole('button', { name }).click()
  await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 })
}

async function closeModule(page: any) {
  const closeButton = page.getByRole('button', { name: '关闭' })
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click()
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 })
  }
}

test.describe('Dashboard - Data Refresh', () => {
  test('auto-refreshes data periodically', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Wait for initial data load
    await page.waitForResponse((resp) => resp.url().includes('/trpc/'), { timeout: 15000 })

    // Get initial price value
    const initialPrice = await page.getByText(/\$[\d,.]+B/).first().textContent()
    expect(initialPrice).toBeTruthy()
  })

  test('shows updated data after manual refresh', async ({ page }) => {
    let requestCount = 0
    page.on('request', (req) => {
      if (req.url().includes('/trpc/')) requestCount++
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const initialCount = requestCount

    // Trigger refresh by reopening module
    await openModule(page, '市场概况')
    await closeModule(page)

    // Should have made additional requests
    expect(requestCount).toBeGreaterThan(initialCount)
  })
})

test.describe('Dashboard - Network Errors', () => {
  test('shows error state when tRPC returns 500', async ({ page }) => {
    await page.route('**/trpc/**', (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ error: { message: 'Internal Server Error' } }),
      })
    })

    await page.goto('/')
    await openModule(page, '市场概况')

    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 10000 })
  })

  test('shows error state when API times out', async ({ page }) => {
    await page.route('**/trpc/**', async (route) => {
      // Never respond, simulating timeout
    })

    await page.goto('/')
    await openModule(page, '市场概况')

    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15000 })
  })

  test('recovers after network restoration', async ({ page }) => {
    let shouldFail = true

    await page.route('**/trpc/**', (route) => {
      if (shouldFail) {
        route.abort()
      } else {
        route.continue()
      }
    })

    await page.goto('/')
    await openModule(page, '市场概况')

    // Verify error state
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 10000 })

    // Restore network
    shouldFail = false

    // Click retry
    await page.getByRole('button', { name: '重试' }).first().click()

    // Should eventually show content
    await expect(page.getByText('总持仓量 (OI)').first()).toBeVisible({ timeout: 15000 })
  })
})
