export interface DashboardContext {
  activeTab: string;
  timeRange?: string;
  filters?: Record<string, unknown>;
  lastUpdated: string;
}

export function buildSystemPrompt(context: DashboardContext): string {
  return `You are Kok Dashboard AI assistant. Current view: ${context.activeTab}`;
}
