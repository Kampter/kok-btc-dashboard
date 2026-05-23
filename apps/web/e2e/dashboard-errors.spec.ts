import { test, expect, type Page } from '@playwright/test'

async function openModule(page: Page, name: string) {
  await page.getByRole('button', { name }).click()
  await page.waitForSelector('[role="dialog"]', { state: 'visible', timeout: 5000 })
}

async function closeModule(page: Page) {
  const closeButton = page.getByRole('button', { name: '关闭' })
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click()
    await page.waitForSelector('[role="dialog"]', { state: 'hidden', timeout: 5000 })
  }
}

test.describe('Dashboard - Data Refresh', () => {
  test('loads initial data successfully', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Wait for loading skeletons to disappear (data loaded)
    await page.waitForSelector('.animate-pulse', { state: 'hidden', timeout: 15000 })

    // Verify data is displayed on at least one overview card
    const firstCard = page.getByRole('button', { name: '市场概况' })
    await expect(firstCard).toBeVisible()
  })

  test('shows module detail after opening', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Open a module
    await openModule(page, '市场概况')

    // Verify detail content is visible
    await expect(page.getByText('总持仓量 (OI)')).toBeVisible()
    await expect(page.getByText('24h 交易量分布（按到期日）')).toBeVisible()
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
    await page.route('**/trpc/**', (route) => {
      route.abort('timedout')
    })

    await page.goto('/')
    await openModule(page, '市场概况')

    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15000 })
  })

  test('error fallback shows retry button', async ({ page }) => {
    await page.route('**/trpc/**', (route) => route.abort())

    await page.goto('/')
    await openModule(page, '市场概况')

    // Verify error state with retry button
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 15000 })
    await expect(page.getByRole('button', { name: '重试' }).first()).toBeVisible({ timeout: 10000 })
  })
})
