export interface DashboardContext {
  activeTab: string;
  timeRange?: string;
  filters?: Record<string, unknown>;
  lastUpdated: string;
}

export function buildSystemPrompt(context: DashboardContext): string {
  return `你是 Kok Dashboard 的投资分析助手，专注于 BTC 期权数据分析。

当前用户视图：${context.activeTab}
数据更新时间：${context.lastUpdated}

回答要求：
- 基于数据给出分析，避免泛泛而谈
- 关键指标用加粗标注
- 必要时给出风险提示`;
}
