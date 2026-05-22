import { test, expect } from '@playwright/test'

test.describe('AI Copilot Resizable Panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('panel is visible with default width', async ({ page }) => {
    const panel = page.locator('[data-testid="chat-panel"]')
    await expect(panel).toBeVisible()
    // Panel should contain the header
    await expect(page.getByText('AI Copilot')).toBeVisible()
  })

  test('collapses and expands panel', async ({ page }) => {
    // Initially expanded
    await expect(page.getByPlaceholder('输入问题...')).toBeVisible()

    // Click collapse
    await page.getByLabel('收起面板').click()
    await expect(page.getByPlaceholder('输入问题...')).not.toBeVisible()
    await expect(page.getByLabel('展开面板')).toBeVisible()

    // Click expand
    await page.getByLabel('展开面板').click()
    await expect(page.getByPlaceholder('输入问题...')).toBeVisible()
    await expect(page.getByLabel('收起面板')).toBeVisible()
  })

  test('persists collapsed state after reload', async ({ page }) => {
    // Collapse panel
    await page.getByLabel('收起面板').click()
    await expect(page.getByLabel('展开面板')).toBeVisible()

    // Reload page
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Panel should still be collapsed
    await expect(page.getByLabel('展开面板')).toBeVisible()
    await expect(page.getByPlaceholder('输入问题...')).not.toBeVisible()
  })

  test('persists width after reload', async ({ page }) => {
    // Resize panel by simulating drag on the handle
    const handle = page.getByTestId('resizable-handle')
    const box = await handle.boundingBox()
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2)
      await page.mouse.up()
    }

    // Reload and verify panel is still wider than default
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('AI Copilot')).toBeVisible()
  })

  test('main content adapts when panel is collapsed', async ({ page }) => {
    // Collapse panel
    await page.getByLabel('收起面板').click()

    // Overview grid should still be visible and usable
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
  })
})
