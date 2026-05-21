---
name: 25d-skew-design
description: 25Δ Skew 与标准期限 ATM IV 指标设计：从 moneyness-based 升级为 Delta-based 的行业标准方法
metadata:
  type: project
---

# 25Δ Skew 与标准期限 ATM IV 指标设计

## 背景

Dashboard 现有的波动率分析模块使用 moneyness-based 方法（strike/underlying_price 分桶），存在以下问题：

- **不精确**：moneyness 分桶混合 Call 和 Put，无法区分方向性
- **非标准**：行业通用的 Skew 指标基于 Delta，而非行权价/现货比
- **不可比**：不同到期日的 moneyness 含义不同（远期 ATM strike 因 cost of carry 不同）

**决策**：升级到 Delta-based 方法，对齐 CoinKarma 等主流期权分析平台的指标体系。

## 指标定义

### 1. 25Δ Skew

**公式**：`Skew = IV(Put) − IV(Call)`

- 取 **+0.25 Delta 的 Call**（虚值看涨期权）的 mark_iv
- 取 **-0.25 Delta 的 Put**（虚值看跌期权）的 mark_iv
- Skew = Put IV − Call IV

**市场含义**：

| Skew 值 | 含义 | 极端阈值 |
|---------|------|---------|
| > 0 | Put 更贵，市场恐惧看跌 | > +8：极度恐惧 |
| < 0 | Call 更贵，市场乐观看涨 | < -8：极度乐观 |
| = 0 | 两者相等，中性 | — |

**按期限分组**：1M / 3M / 6M 标准期限分别计算 Skew，展示期限结构。

### 2. ATM IV 期限结构

**定义**：每个标准期限取最接近 **±0.50 Delta**（ATM）期权的 mark_iv。

**标准期限**：

| 期限 | 目标天数 | 说明 |
|------|---------|------|
| 1M | 30 天 | 短期，对突发事件敏感 |
| 3M | 90 天 | 中期，反映中期预期 |
| 6M | 180 天 | 长期，反映长期趋势预期 |

**分组规则**：对每个标准期限，在所有可用到期日中找到天数最接近目标值的那个。

**Tie-breaking**：如果两个到期日距离目标天数的差值相同，优先选天数更长的那个。

### 3. 历史波动率 (HV)

**保持不变**：继续使用 `get_historical_volatility` 数据，单折线图展示。

## 技术实现

### Delta 计算

Deribit `get_book_summary_by_currency` 不返回 Greeks，需本地计算：

- **模型**：Black-Scholes
- **参数**：
  - `S` = underlying_price
  - `K` = strike
  - `T` = (expiry − now) / (365 × 24 × 3600)（年化）
  - `σ` = mark_iv / 100
  - `r` = 0（crypto 期权无风险利率近似为 0）
- **Call Delta** = N(d1)
- **Put Delta** = N(d1) − 1

**边界处理**：
- `T ≤ 0`：返回 `Infinity`（ITM）或 `-Infinity`（OTM）
- `σ ≤ 0 || S <= 0 || K <= 0`：返回 `NaN`

### 数据流

```
Deribit API → bookData (OptionSummary[]) 
  → groupByTenor() → Map<Tenor, OptionSummary[]>
    → 对每个 Tenor:
      → calculate25DeltaSkew() → Skew 值
      → calculateATMIV() → ATM IV 值
  → 渲染图表
```

**复杂度**：O(n)，n = 单币种期权数量（通常几十到几百个）。

## UI 设计

### VolatilityAnalysis 抽屉（3 个图表）

| 图表 | 类型 | X 轴 | Y 轴 | 说明 |
|------|------|------|------|------|
| 25Δ Skew（按期限） | 柱状图 | 1M / 3M / 6M | Skew (%) | 正值绿色/负值红色，0 线参考 |
| ATM IV 期限结构 | 折线图 | 1M / 3M / 6M | ATM IV (%) | 单条线 |
| 历史波动率 (HV) | 折线图 | 日期 | HV (%) | 保留原实现 |

### VolatilityOverviewCard 概览卡片

- **KPI**：1M 25Δ Skew
- **状态标签**：
  - Skew > 0 → "偏恐惧"（negative/红色）
  - Skew < 0 → "偏乐观"（positive/绿色）
  - Skew = 0 → "中性"

> 注意：positive/negative 映射到颜色时，Skew > 0（恐惧）对应 negative（红色），因为恐惧是负面市场信号。

## 与原始 Spec 的映射关系

| 原始 Spec (2026-05-17) | 当前实现 | 说明 |
|------------------------|---------|------|
| IV 期限结构：X轴=DTE，多条线（当前/24h前/7天前） | ATM IV 期限结构：X轴=1M/3M/6M，单条线 | **替换**：标准期限更直观，历史对比待后续实现 |
| Skew 曲线：X轴=Moneyness，多折线（7D/30D/90D） | 25Δ Skew：X轴=期限，柱状图 | **替换**：Delta-based 是行业标准 |
| 历史波动率 vs 隐含波动率：双折线 | 历史波动率 (HV)：单折线 | **简化**：移除 ATM IV 叠加，避免信息重复 |
| 数据来源：按到期日分组取 ATM strike | 数据来源：BS 模型计算 Delta 找最近期权 | **方法升级**：从静态 strike 匹配升级为动态 Delta 匹配 |

## 验收标准

- [x] 25Δ Skew 柱状图正确显示 1M/3M/6M 三个柱
- [x] ATM IV 期限结构折线图正确显示三个点
- [x] 概览卡片显示 1M 25Δ Skew 值和恐惧/乐观状态
- [x] Delta 计算与已知 BS 值误差 < 0.001
- [x] 空数据时图表不崩溃
- [x] 113 个 web 测试全部通过

## 文件清单

| 文件 | 作用 |
|------|------|
| `apps/web/app/lib/greeks.ts` | Black-Scholes Delta 计算 |
| `apps/web/app/lib/volatility.ts` | 期限分组 + 最近 Delta 查找 |
| `apps/web/app/components/modules/VolatilityAnalysis.tsx` | 波动率分析抽屉组件 |
| `apps/web/app/components/modules/overview/VolatilityOverviewCard.tsx` | 概览卡片 |
| `packages/shared-types/src/fixtures/derived/optionSummary.ts` | Mock fixtures（12 条，覆盖 3 期限 × ATM/25Δ） |
