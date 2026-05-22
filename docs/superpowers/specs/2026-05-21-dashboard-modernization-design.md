---
name: dashboard-modernization-design
description: BTC Options Dashboard 现代化改造设计规范 — 概览网格 + 极简精致风格 + 右侧详情抽屉
metadata:
  type: project
---

# Dashboard 现代化改造设计规范

## 背景与目标

当前 Dashboard 采用 Tab 切换组织 7 个分析模块（市场概况、波动率分析、持仓结构、资金情绪、到期分析、OI 分布、Greeks 风险暴露），存在以下问题：

- **信息分散**：用户必须逐个 Tab 切换才能看到各模块数据，无法一眼掌握全局
- **视觉平庸**：使用 shadcn/ui 默认暗色主题，缺乏品牌辨识度
- **交互低效**：模块间切换成本高，不适合快速对比分析

### 设计目标

1. **一屏概览**：首屏展示所有模块核心指标，无需切换即可掌握全局
2. **极简精致**：参考 Linear 的设计语言，追求高级感与信息密度的平衡
3. **快速深入**：点击概览卡片即可展开详情，保持上下文不丢失
4. **改造可控**：中量改造范围，不重构现有模块内部逻辑

---

## 视觉系统

### 色彩

从当前"工具感"暗色主题升级为"精致感"暗色主题：

| Token | 当前值 | 新值 | 说明 |
|-------|--------|------|------|
| `--color-background` | `#0f172a` | `#08080a` | 更深更纯粹的背景，消除蓝色调 |
| `--color-foreground` | `#f8fafc` | `#f4f4f5` | 微暖的白色，降低刺眼感 |
| `--color-card` | `#1e293b` | `#121214` | 卡片底色与背景形成微妙层次 |
| `--color-card-foreground` | `#f8fafc` | `#f4f4f5` | 卡片内文字色 |
| `--color-muted` | `#334155` | `#27272a` | 分割线、次要元素 |
| `--color-muted-foreground` | `#94a3b8` | `#71717a` | 标签、次要文字 |
| `--color-border` | `#334155` | `#27272a` | 边框更 subtle |
| `--color-primary` | `#e94560` | `#e94560` | 保留品牌红（不改动） |
| `--color-call` | `#4ade80` | `#22c55e` | 绿色略微降低饱和度 |
| `--color-put` | `#e94560` | `#ef4444` | 红色统一为更标准的红色 |
| `--color-warning` | `#f59e0b` | `#f59e0b` | 保留 |
| `--radius` | `0.5rem` | `0.75rem` | 圆角加大，增加精致感 |

### 字体

引入 Geist 字体家族：

- **显示/标题**：`Geist Sans` — 现代几何无衬线，清晰精致
- **数据/代码**：`Geist Mono` — 等宽字体，数字对齐，金融数据必备
- **备用栈**：`'Geist Sans', 'Geist Mono', system-ui, sans-serif`

通过 `@fontsource-variable/geist` 或 Google Fonts CDN 加载。

### 间距

采用 4px 基准网格：

| Token | 值 | 用途 |
|-------|-----|------|
| `space-1` | 4px | 图标与文字间距 |
| `space-2` | 8px | 组件内部小间距 |
| `space-3` | 12px | 卡片内边距（紧凑） |
| `space-4` | 16px | 卡片内边距（标准） |
| `space-6` | 24px | 区块间距 |
| `space-8` | 32px | 页面边距 |

### 阴影与层次

| Token | 值 | 用途 |
|-------|-----|------|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | 卡片默认 |
| `shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` | 悬浮卡片、Drawer |
| `shadow-lg` | `0 8px 24px rgba(0,0,0,0.5)` | Modal、Dropdown |

---

## 布局架构

### 页面结构

```
┌─────────────────────────────────────────────────────┐
│ Header（精简：Logo + 标题 + 数据源 + 刷新状态）      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ 市场概况 │ │ 波动率   │ │ 持仓结构 │               │
│  │ $12.4B  │ │ 45.2%   │ │ 0.72    │               │
│  │ [迷你图] │ │ [趋势]   │ │ [分布]   │               │
│  └─────────┘ └─────────┘ └─────────┘               │
│                                                     │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐               │
│  │ 资金情绪 │ │ 到期分析 │ │ OI 分布  │               │
│  │ -0.15   │ │ 看涨     │ │ $85K    │               │
│  │ [情绪条] │ │ [饼图]   │ │ [蝴蝶]   │               │
│  └─────────┘ └─────────┘ └─────────┘               │
│                                                     │
├──────────────────┬──────────────────────────────────┤
│                  │                                  │
│  Agent Chat      │  [选中模块的详情内容]            │
│  Panel           │  （点击概览卡片后显示）           │
│  （左侧固定）     │                                  │
│                  │                                  │
└──────────────────┴──────────────────────────────────┘
```

实际渲染时：
- **左侧**：Agent Chat Panel（宽度 320px，可折叠）
- **中间主区**：概览网格（6 张卡片，响应式 3×2 → 2×3 → 1×6）
- **右侧**：Module Drawer（宽度 520px，滑入/滑出）

### 响应式断点

| 断点 | 布局 |
|------|------|
| `≥1280px` | 3 列网格 + 右侧 Drawer（520px）+ 左侧 Chat Panel |
| `1024-1279px` | 3 列网格 + 全屏 Drawer 覆盖 + 左侧 Chat Panel |
| `768-1023px` | 2 列网格 + 全屏 Drawer 覆盖 + Chat Panel 可折叠 |
| `<768px` | 1 列网格 + 全屏 Drawer + Chat Panel 完全隐藏 |

---

## 组件规范

### 1. OverviewCard（概览卡片）

每个模块对应一张概览卡片，展示该模块最核心的 1-3 个指标 + 一个迷你可视化。

```tsx
interface OverviewCardProps {
  moduleId: ModuleId;
  title: string;
  kpi: { label: string; value: string; change?: string; changeType?: 'positive' | 'negative' | 'neutral' };
  miniChart?: React.ReactNode; // 迷你图表或趋势指示器
  status?: 'loading' | 'error' | 'ready';
  onClick: () => void;
}
```

**样式规范**：
- 背景：`bg-card`（`#121214`）
- 圆角：`rounded-xl`（12px）
- 内边距：`p-4`（16px）
- 边框：`border border-border`（默认 subtle 边框）
- Hover：`hover:border-muted-foreground/30 hover:shadow-md`（边框提亮 + 阴影加深）
- 激活态（选中）：`border-primary ring-1 ring-primary/20`
- 过渡：`transition-all duration-200`

**各模块概览卡片内容**：

| 模块 | 核心 KPI | 迷你可视化 |
|------|----------|------------|
| 市场概况 | 总 OI、24h 交易量、BTC 价格 | 24h 交易量迷你柱状图 |
| 波动率分析 | **1M 25Δ Skew** | 无迷你可视化 | ✅ 已更新，详见 [[25d-skew-design]] |
| 持仓结构 | P/C Ratio、多空比 | 多空比迷你进度条 |
| 资金情绪 | 资金费率、情绪指数 | 资金费率迷你折线图 |
| 到期分析 | 最大到期日、P/C 到期分布 | 到期分布迷你柱状图 |
| OI 分布 | Max Pain、阻力/支撑 | 行权价 OI 迷你蝴蝶图 |

### 2. ModuleDrawer（详情抽屉）

从右侧滑出的详情面板，承载完整的模块组件。

```tsx
interface ModuleDrawerProps {
  moduleId: ModuleId | null;
  onClose: () => void;
}
```

**样式规范**：
- 宽度：桌面端 `520px`，移动端 `100vw`
- 背景：`bg-background`（与页面背景一致，形成连续感）
- 边框：左侧 `border-l border-border`
- 阴影：`shadow-lg`
- Header：模块标题 + 关闭按钮 + 刷新按钮
- 内容区：直接渲染对应模块的完整组件
- 底部：可留空或显示数据更新时间

**动画**：
- 打开：`translateX(100%) → translateX(0)`，`duration: 300ms`，`easing: cubic-bezier(0.16, 1, 0.3, 1)`
- 关闭：`translateX(0) → translateX(100%)`，`duration: 200ms`
- 背景遮罩：`opacity: 0 → 0.4`，点击遮罩关闭

### 3. Header（精简头部）

```tsx
// 当前 Header 内容过多，精简为：
// Logo（左侧）+ 标题（居中或左侧）+ 数据源状态 + 刷新指示器
```

**样式规范**：
- 高度：`h-14`（56px）
- 背景：`bg-background/80 backdrop-blur-sm`（毛玻璃效果，滚动时可见）
- 边框：底部 `border-b border-border`
- 内容：左侧 Logo + "BTC Options Dashboard" 标题，右侧 Deribit 状态点 + "自动刷新 30s" 文字

---

## 数据流

### 概览卡片数据

每个 OverviewCard 需要**轻量级**数据，与详情 Drawer 中的完整数据可以共用同一 tRPC hook，但只展示前几个字段。

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  OverviewCard   │────▶│  useDashboardData │────▶│   tRPC API      │
│  （只取KPI字段） │     │  （已有 hooks）   │     │  （已有端点）   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │
         │ 点击
         ▼
┌─────────────────┐
│  ModuleDrawer   │────▶ 渲染完整模块组件（已有）
│  （详情视图）    │
└─────────────────┘
```

**注意**：当前 hooks 可能返回大量数据，OverviewCard 只消费其中少量字段，性能上不构成问题。如果后续需要优化，可在 tRPC 端点中增加轻量字段选择。

### 状态管理

- `activeModule: ModuleId | null` — 当前展开的模块（由 `DashboardLayout` 管理）
- `isDrawerOpen: boolean` — Drawer 开关状态
- 数据获取仍由现有 `useDashboardData` hooks 负责，不引入新状态层

---

## 动画规范

### 页面加载

- 概览卡片依次进入：`opacity: 0, translateY(8px) → opacity: 1, translateY(0)`
- Stagger：每张卡片延迟 `50ms`
- Duration：`300ms`
- Easing：`cubic-bezier(0.16, 1, 0.3, 1)`

### 卡片交互

- Hover：`border-color` 变化 + `shadow` 加深，`duration: 200ms`
- 点击：轻微缩放 `scale(0.98)`，`duration: 100ms`，释放后恢复
- 选中态：边框变为 primary 色 + 微弱 glow

### Drawer 动画

见上文 ModuleDrawer 动画规范。

### 数据更新

- KPI 数值变化时：数字快速淡入淡出（计数动画可选，初期不做）
- 迷你图表数据更新：`opacity` 短暂闪烁提示

---

## 改造范围（中量改造）

### 修改文件清单

#### 新增文件

| 文件 | 说明 |
|------|------|
| `app/components/OverviewGrid.tsx` | 概览网格容器，管理 6 张卡片布局 |
| `app/components/OverviewCard.tsx` | 单张概览卡片组件 |
| `app/components/ModuleDrawer.tsx` | 右侧详情抽屉 |
| `app/components/modules/overview/` | 各模块概览数据展示子组件（6 个文件） |
| `app/lib/chart-theme.ts` | Recharts 暗色主题配置 |

#### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `app/globals.css` | 更新 CSS 变量（色彩、圆角、阴影） |
| `app/routes/__root.tsx` | 加载 Geist 字体 |
| `app/components/DashboardLayout.tsx` | 重构为概览网格 + Drawer 布局 |
| `app/components/metrics/KPICard.tsx` | 适配新视觉系统（可选，可能被 OverviewCard 替代） |

#### 不修改的文件（保持现状）

| 文件 | 原因 |
|------|------|
| `app/components/modules/MarketOverview.tsx` | 详情 Drawer 中直接复用 |
| `app/components/modules/VolatilityAnalysis.tsx` | 同上 |
| `app/components/modules/PositionStructure.tsx` | 同上 |
| `app/components/modules/FundingSentiment.tsx` | 同上 |
| `app/components/modules/ExpiryAnalysis.tsx` | 同上 |
| `app/components/modules/OIDistribution.tsx` | 同上 |
| `app/components/chat/AgentChatPanel.tsx` | 本次不涉及 |
| `app/hooks/useDashboardData.ts` | 已有 hooks 可直接复用 |
| `app/components/ui/*` | shadcn/ui 基础组件保持不变 |

### 图表主题

为 Recharts 配置统一的暗色主题，避免每个图表单独硬编码颜色：

```ts
// lib/chart-theme.ts
export const chartTheme = {
  grid: { stroke: '#27272a', strokeDasharray: '3 3' },
  axis: { stroke: '#71717a', fontSize: 12, fontFamily: 'Geist Mono' },
  tooltip: {
    backgroundColor: '#121214',
    border: '1px solid #27272a',
    borderRadius: '8px',
    fontSize: 12,
  },
  colors: {
    call: '#22c55e',
    put: '#ef4444',
    neutral: '#71717a',
    primary: '#e94560',
    warning: '#f59e0b',
  },
};
```

---

## YAGNI（明确不做）

以下功能不在本次改造范围内：

1. **自定义字体加载优化**（如子集化、预加载）— 标准 CDN 加载即可
2. **Framer Motion 复杂动画** — 使用 CSS transition 足矣
3. **图表库替换**（Recharts → 其他）— 保持 Recharts，只做主题定制
4. **概览卡片实时 WebSocket 推送** — 沿用现有 30s 轮询
5. **多币种支持（BTC 以外的币种）** — UI 上预留位置但不实现
6. **用户偏好持久化**（记住展开的模块）— 纯内存状态

---

## 成功标准

1. 首屏可见全部 7 个模块的核心指标，无需 Tab 切换
2. 点击任意卡片后，右侧 Drawer 在 300ms 内平滑滑出展示详情
3. 视觉风格统一为"极简精致"，无 shadcn/ui 默认感
4. 所有现有功能保持不变（数据准确性、Agent Chat、自动刷新等）
5. 响应式适配桌面端和常见平板尺寸

---

## 参考

- **风格参考**：Linear（linear.app）— 极简、精致、信息密度高
- **布局参考**：TradingView Dashboard — 概览 + 详情双区
- **字体**：Geist（vercel.com/font）— Vercel 开源字体家族
