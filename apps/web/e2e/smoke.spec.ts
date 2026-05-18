import { test, expect } from '@playwright/test'

test('homepage loads and displays hello message', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Hello Kok')).toBeVisible()
})
