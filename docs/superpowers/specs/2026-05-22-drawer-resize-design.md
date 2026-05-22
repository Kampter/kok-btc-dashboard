# Drawer 拖拽调整宽度设计文档

## 背景

当前 Dashboard 的右侧详情面板（ModuleDrawer）宽度固定为 `520px`。当数据量较大的图表（如按到期日分布的成交量柱状图）在这个固定宽度下展示时，由于 `ResponsiveContainer` 强制 100% 填充，图表显得拥挤、X 轴标签重叠，严重影响可读性。

## 目标

将 ModuleDrawer 改造为可拖拽调整宽度的面板，用户可根据需要拉宽以获得更好的图表阅读体验。

## 约束

- 最小宽度：`480px`
- 最大宽度：视口宽度的 `80%`
- 记忆功能：使用 localStorage 记住用户上次调整后的宽度，下次打开时恢复
- SSR 安全：localStorage 只在 `useEffect` 中访问

## 架构

```
ModuleDrawer (业务 wrapper)
  └── ResizableDrawer (通用可拖拽面板)
        ├── ResizeHandle (拖拽手柄)
        ├── Header (标题 + 关闭按钮)
        └── Content (滚动内容区)
```

- `ResizableDrawer` 是一个纯 UI 组件，职责单一：可拖拽调整宽度的滑出面板
- `ModuleDrawer` 退化为业务 wrapper，只负责 `moduleId → 详情组件` 的映射和标题映射

## ResizableDrawer API

```typescript
export interface ResizableDrawerProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  defaultWidth?: number       // default: 520
  minWidth?: number           // default: 480
  maxWidth?: number           // default: Math.floor(window.innerWidth * 0.8)
  storageKey?: string         // default: 'kok:drawer:width'
}
```

## 交互细节

### 拖拽手柄

- **位置**：drawer 内侧边缘（右 drawer 为左边缘），绝对定位 `left-0 top-0 bottom-0`
- **尺寸**：宽 `6px`，热区宽 `12px`（方便点击）
- **样式**：默认半透明背景 `bg-muted/30`，hover 时 primary 色高亮 `bg-primary/40`
- **光标**：`cursor: col-resize`

### 拖拽逻辑

1. `mousedown`/`touchstart` 在 handle 上触发 → 开始拖拽
2. 绑定 window 级 `mousemove`/`touchmove` 和 `mouseup`/`touchend`
3. 拖拽时：
   - 记录拖拽起始时的鼠标位置和 drawer 宽度
   - `delta = dragStartX - clientX`
   - `newWidth = dragStartWidth + delta`
   - clamp：`Math.max(minWidth, Math.min(maxWidth, newWidth))`
   - 实时更新宽度状态，无 CSS transition（避免拖拽卡顿）
   - 给 `document.body` 添加 `cursor: col-resize` 和 `user-select: none`（防止拖拽时选中文本）
4. `mouseup`/`touchend` 时：
   - 清理事件监听器
   - 恢复 body 原始样式（保存并还原 cursor 和 user-select）
   - 将最终宽度写入 localStorage

### 窗口 resize 处理

- 监听 `window resize`，若当前宽度 > 新的 maxWidth，自动收缩至 maxWidth
- 若当前宽度 < minWidth，自动扩展至 minWidth

### 动画

- 保留现有 CSS keyframe 动画（`slideInRight` / `slideOutRight`），宽度变化无 transition
- 拖拽过程中，backdrop 和 drawer 的宽度同时实时更新

## ModuleDrawer 改造

`ModuleDrawer.tsx` 将移除所有样式、动画、宽度逻辑，仅保留：
- `moduleId → title` 映射
- `moduleId → DetailComponent` 映射
- 渲染 `<ResizableDrawer title={title} onClose={handleClose} isOpen={isOpen}>{children}</ResizableDrawer>`

## 文件变更

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `apps/web/app/components/ResizableDrawer.tsx` | 新增 | 通用可拖拽面板组件 |
| `apps/web/app/components/ModuleDrawer.tsx` | 修改 | 退化为业务 wrapper |

## 测试

### 单元测试（Vitest）

- 边界 clamp 逻辑：`< minWidth` → `minWidth`，`> maxWidth` → `maxWidth`
- localStorage 读写：打开时读取存储值，拖拽结束时写入
- props 传递：title、children 正确渲染

### E2E 测试（Playwright）

- 拖拽 handle 调整宽度，验证实际 DOM 宽度变化
- 关闭后重新打开，验证宽度保持不变
- 拖拽至边界，验证不超过 min/max
- 窗口 resize 后，验证宽度自动调整

## 风险

- **性能**：频繁 setState 在拖拽时是否会导致卡顿？React 18 的 concurrent features 应该可以处理，但需要在实现后做性能验证
- **触摸设备**：触摸拖拽体验需要测试，handle 热区需要足够大
- **无障碍**：需要为 handle 添加 aria-label，支持键盘调整（可选，可作为后续增强）
