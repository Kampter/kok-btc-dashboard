import { test, expect, type Page } from '@playwright/test'

async function openModule(page: Page, name: string) {
  await page.getByRole('button', { name }).click()
  // 等待 Drawer 打开
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
    await page.waitForLoadState('networkidle')

    await openModule(page, '市场概况')
    await expect(page.getByText('总持仓量 (OI)')).toBeVisible()
    await expect(page.getByText('24h 交易量分布（按到期日）')).toBeVisible()
  })

  test('switching module updates drawer content', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 打开市场概况
    await openModule(page, '市场概况')
    await expect(page.getByText('24h 交易量分布（按到期日）')).toBeVisible()

    // 关闭并切换到波动率分析
    await closeModule(page)
    await openModule(page, '波动率分析')
    // 等待 loading skeleton 消失
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
    await page.waitForLoadState('networkidle')

    const modules = ['市场概况', '波动率分析', '持仓结构', '资金情绪', '到期分析']
    for (let i = 0; i < 10; i++) {
      const mod = modules[i % modules.length]
      await closeModule(page)
      await openModule(page, mod)
      // 短暂等待内容渲染
      await page.waitForTimeout(200)
    }
    await closeModule(page)
    // 页面应仍然可用
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
  })

  test('all modules render without console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const modules = ['波动率分析', '持仓结构', '资金情绪', '到期分析']
    for (const mod of modules) {
      await openModule(page, mod)
      // 等待 loading skeleton 消失后再关闭
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
    // 等待第一个 tRPC 响应返回
    await page.waitForResponse((resp) => resp.url().includes('/trpc/'), { timeout: 15000 })

    // 检查 Overview Grid 显示非零数据
    const btcPrice = await page.getByText(/\$[\d,.]+B/).first()
    const hasNonZeroData = await btcPrice.isVisible().catch(() => false)
    expect(hasNonZeroData).toBe(true)

    // 打开 Drawer 验证详细内容
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
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
    // 在 tablet 上也可以点击卡片打开 Drawer
    await openModule(page, '市场概况')
    await expect(page.getByText('总持仓量 (OI)')).toBeVisible()
  })

  test('renders correctly on large desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: '市场概况' })).toBeVisible()
    // 在 desktop 上也可以点击卡片打开 Drawer
    await openModule(page, '市场概况')
    await expect(page.getByText('总持仓量 (OI)')).toBeVisible()
  })
})

test.describe('Dashboard - Error States', () => {
  test('shows loading skeleton on initial load', async ({ page }) => {
    await page.goto('/')
    // Skeleton 应在数据加载前短暂可见
    await expect(page.locator('.animate-pulse').first()).toBeVisible()
  })

  test('retry button appears on error', async ({ page }) => {
    // 阻止 API 请求以模拟错误
    await page.route('**/trpc/**', (route) => route.abort())
    await page.goto('/')
    // Error fallback 应最终出现在 Drawer 中
    await openModule(page, '市场概况')
    await expect(page.getByText('加载失败').first()).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Dashboard - Drawer Resize', () => {
  test('can resize drawer by dragging handle', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await openModule(page, '市场概况')
    // TODO: 等待 drawer 入场动画完成（300ms slideInRight）。
    // Playwright 的 waitForSelector 只能确认元素存在，无法检测 CSS animation 结束。
    // 使用固定延迟等待动画稳定，避免并发时元素定位超时。
    await page.waitForTimeout(500)

    const drawer = page.getByTestId('resizable-drawer')
    const handle = page.getByTestId('resize-handle')

    // Get initial width
    const initialWidth = await drawer.evaluate((el) => el.getBoundingClientRect().width)
    expect(initialWidth).toBe(520)

    // Drag handle to the left to widen drawer
    const handleBox = await handle.boundingBox()
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(handleBox.x - 200, handleBox.y + handleBox.height / 2)
      await page.mouse.up()
    }

    // Verify width increased
    const newWidth = await drawer.evaluate((el) => el.getBoundingClientRect().width)
    expect(newWidth).toBeGreaterThan(520)
  })

  test('drawer width respects minimum boundary', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await openModule(page, '市场概况')
    await page.waitForTimeout(500)

    const drawer = page.getByTestId('resizable-drawer')
    const handle = page.getByTestId('resize-handle')

    // Drag handle far to the right to shrink beyond min
    const handleBox = await handle.boundingBox()
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(handleBox.x + 500, handleBox.y + handleBox.height / 2)
      await page.mouse.up()
    }

    // Verify width is not below 480
    const width = await drawer.evaluate((el) => el.getBoundingClientRect().width)
    expect(width).toBeGreaterThanOrEqual(480)
  })

  test('drawer width respects maximum boundary', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await openModule(page, '市场概况')
    await page.waitForTimeout(500)

    const drawer = page.getByTestId('resizable-drawer')
    const handle = page.getByTestId('resize-handle')

    // Drag handle far to the left to expand beyond 80%
    const handleBox = await handle.boundingBox()
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(handleBox.x - 800, handleBox.y + handleBox.height / 2)
      await page.mouse.up()
    }

    // Verify width is not above 80% of 1440 = 1152
    const width = await drawer.evaluate((el) => el.getBoundingClientRect().width)
    expect(width).toBeLessThanOrEqual(1152)
  })

  test('remembers drawer width after close and reopen', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await openModule(page, '市场概况')
    await page.waitForTimeout(500)

    const drawer = page.getByTestId('resizable-drawer')
    const handle = page.getByTestId('resize-handle')

    // Resize to a custom width
    const handleBox = await handle.boundingBox()
    if (handleBox) {
      await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
      await page.mouse.down()
      await page.mouse.move(handleBox.x - 300, handleBox.y + handleBox.height / 2)
      await page.mouse.up()
    }

    const customWidth = await drawer.evaluate((el) => el.getBoundingClientRect().width)
    expect(customWidth).toBeGreaterThan(520)

    // Close and reopen
    await closeModule(page)
    await openModule(page, '市场概况')
    await page.waitForTimeout(500)

    // Verify width persisted
    const persistedWidth = await page.getByTestId('resizable-drawer').evaluate(
      (el) => el.getBoundingClientRect().width
    )
    expect(persistedWidth).toBe(customWidth)
  })
})
