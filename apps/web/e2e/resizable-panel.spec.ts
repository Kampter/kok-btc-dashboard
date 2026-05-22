import { test, expect } from '@playwright/test'

test.describe('AI Copilot Resizable Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure clean localStorage for each test
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
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
    const panel = page.locator('[data-testid="chat-panel"]')
    const initialBox = await panel.boundingBox()

    // Resize panel by simulating drag on the handle
    const handle = page.getByTestId('resizable-handle')
    const handleBox = await handle.boundingBox()
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      // Allow browser time to register the mousemove listener before moving
      await page.waitForTimeout(100)
      await page.mouse.move(handleBox.x + handleBox.width / 2 + 100, handleBox.y + handleBox.height / 2)
      await page.mouse.up()
    }

    // Verify panel is wider after drag
    await page.waitForTimeout(200)
    const draggedBox = await panel.boundingBox()
    expect(draggedBox!.width).toBeGreaterThan(initialBox!.width)

    // Verify localStorage was updated
    const savedWidth = await page.evaluate(() => {
      const raw = localStorage.getItem('kok:copilot-panel')
      return raw ? JSON.parse(raw).width : null
    })
    expect(savedWidth).toBeGreaterThan(380)

    // Reload and verify panel is still wider than default
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(200)
    const restoredBox = await panel.boundingBox()
    expect(restoredBox!.width).toBeGreaterThan(380)
  })

  test('main content adapts when panel is collapsed', async ({ page }) => {
    // Collapse panel
    await page.getByLabel('收起面板').click()

    // Overview grid should still be visible and usable
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
  })
})
