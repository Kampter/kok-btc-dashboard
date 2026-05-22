# AI Copilot 可伸缩面板设计

## 背景

当前 `AgentChatPanel` 固定在 `DashboardLayout` 左侧，宽度固定 `380px`，无法调整。用户希望在需要更多空间查看 Dashboard 内容时，能够缩小或收起 AI Copilot 面板。

## 目标

- 支持拖拽调整 AI Copilot 面板宽度
- 支持一键折叠/展开面板
- 面板视觉风格与 Dashboard 统一，同时保持功能区分度
- 用户偏好（宽度、折叠状态）持久化

## 设计决策

### 交互方案

采用 **拖拽 + 折叠** 组合方案：

- **拖拽调整宽度**：鼠标悬停面板右边缘时显示拖拽光标（`col-resize`），按住拖拽实时调整宽度
- **折叠/展开**：面板头部右侧添加折叠按钮（`≪`），点击后收起为左侧 40px 窄条；窄条显示展开按钮（`≫`），点击恢复
- **宽度限制**：最小 280px，最大 600px，默认 380px
- **状态持久化**：宽度和折叠状态保存到 `localStorage`，键名为 `kok:copilot-panel`，刷新后自动恢复

### 视觉风格

与 Dashboard 统一暗色主题，同时通过以下方式区分 AI 区域：

- **面板外壳**：`bg-card` (#121214) + `border-border` (#27272a) + `rounded-xl`
- **消息区域背景**：`#0a0a0c`（比外壳稍深，形成嵌套卡片层次）
- **功能区分标识**：面板左侧 2px `#e94560` (primary) 竖线
- **发送按钮**：`bg-primary` (#e94560)，hover 时 `bg-primary/90`
- **用户消息气泡**：`bg-muted` (#27272a) + `text-foreground`
- **助手消息气泡**：`bg-card` (#121214) + `text-foreground`，带 `border-border` 边框
- **拖拽手柄**：仅 2px 宽分隔线，悬停时显示拖拽光标，无额外视觉元素

### 动画

- **折叠/展开过渡**：`width 0.2s ease-out`，平滑自然
- **拖拽时**：无过渡动画，宽度实时跟随鼠标，避免延迟感
- **窄条展开按钮**：hover 时背景色从 `bg-card` 变为 `bg-muted`，`transition-colors duration-150`

## 组件变更

### AgentChatPanel

重构为核心容器组件，新增以下职责：

- 管理面板宽度状态（`width: number`）
- 管理折叠状态（`isCollapsed: boolean`）
- 处理拖拽逻辑（`mousedown` → `mousemove` → `mouseup`）
- 处理折叠/展开切换
- 从 `localStorage` 读取/写入持久化状态
- 渲染拖拽手柄（`ResizableHandle`）
- 折叠状态下渲染窄条替代完整面板

**Props 不变**：继续使用 `useAgentChat` hook，不需要新增 props。

### ResizableHandle（新增组件）

```
app/components/chat/ResizableHandle.tsx
```

- 2px 宽竖线，绝对定位在面板右边缘
- 悬停时 `cursor: col-resize`
- 接收 `onResizeStart: () => void` callback
- 纯展示组件，不管理状态

### ChatMessage

样式调整为统一暗色主题：

- 用户消息：移除 `bg-blue-600`，改为 `bg-muted text-foreground rounded-xl`
- 助手消息：移除 `bg-slate-200/slate-700` 双色逻辑，统一为 `bg-card text-foreground border border-border rounded-xl`
- 圆角统一为 `rounded-xl`

### ChatInput

样式调整：

- textarea：`bg-background border-border rounded-xl`
- 发送按钮：`bg-primary text-primary-foreground rounded-xl`，hover `bg-primary/90`
- 表单容器：`border-t border-border bg-card`

### DashboardLayout

移除对 `AgentChatPanel` 宽度的硬编码假设。`AgentChatPanel` 自身管理宽度，`DashboardLayout` 只需要保持 `flex` 布局，主内容区自动填充剩余空间。

## 数据流

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│  localStorage   │────▶│  AgentChatPanel  │────▶│  Resizable  │
│  (width/state)  │◄────│  (state manager) │◄────│  Handle     │
└─────────────────┘     └──────────────────┘     └─────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │  ChatMessage     │
                        │  ChatInput       │
                        │  useAgentChat    │
                        └──────────────────┘
```

- `AgentChatPanel` 初始化时从 `localStorage` 读取 `kok:copilot-panel`
- 用户拖拽时，宽度状态实时更新，同时写入 `localStorage`
- 用户折叠/展开时，状态写入 `localStorage`
- `useAgentChat` 及其下游组件不受影响

## 错误处理

- **localStorage 不可用**（如隐私模式）：静默降级，使用默认宽度 380px，不抛出错误
- **存储数据损坏**（非有效 JSON）：使用默认值，覆盖损坏数据
- **拖拽超出边界**：通过 `min/max` 约束限制，不允许超出 280-600px 范围
- **SSR 场景**：`localStorage` 仅在 `useEffect` 中访问，避免服务端渲染错误

## 边界情况

- **窗口尺寸变化**：如果窗口宽度小于当前面板宽度 + 最小主内容区宽度，面板自动收缩到最小 280px
- **折叠后拖拽**：折叠状态下不允许拖拽，需先展开
- **拖拽到最小宽度后继续拖拽**：面板自动进入折叠状态（可选增强，本次不实现，保持简单）

## 测试策略

- **单元测试**（Vitest + jsdom）：
  - `AgentChatPanel` 渲染测试：验证折叠/展开状态切换
  - `ResizableHandle` 交互测试：模拟拖拽事件，验证宽度变化
  - `localStorage` 读写测试：验证持久化逻辑
  - 样式类名快照测试：确保主题色正确应用

- **E2E 测试**（Playwright）：
  - 拖拽调整宽度：验证面板宽度在 280-600px 范围内可调整
  - 折叠/展开：验证点击按钮后面板正确折叠/展开，主内容区自适应
  - 持久化：验证刷新页面后面板保持上次设置的宽度和状态

## 参考

- [apps/web/app/components/chat/AgentChatPanel.tsx](../../../apps/web/app/components/chat/AgentChatPanel.tsx)
- [apps/web/app/components/chat/ChatMessage.tsx](../../../apps/web/app/components/chat/ChatMessage.tsx)
- [apps/web/app/components/chat/ChatInput.tsx](../../../apps/web/app/components/chat/ChatInput.tsx)
- [apps/web/app/components/DashboardLayout.tsx](../../../apps/web/app/components/DashboardLayout.tsx)
- [apps/web/app/globals.css](../../../apps/web/app/globals.css)
