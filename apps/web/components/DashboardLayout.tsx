import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

const MODULES = [
  { id: 'overview', label: '市场概况' },
  { id: 'volatility', label: '波动率分析' },
  { id: 'positions', label: '持仓结构' },
  { id: 'sentiment', label: '资金情绪' },
  { id: 'expiry', label: '到期分析' },
] as const;

type ModuleId = (typeof MODULES)[number]['id'];

export function DashboardLayout() {
  const [activeTab, setActiveTab] = useState<ModuleId>('overview');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold">BTC Options Dashboard</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-call" />
              Deribit
            </span>
            <span>自动刷新 30s</span>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="px-6 pt-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ModuleId)}>
          <TabsList>
            {MODULES.map((m) => (
              <TabsTrigger key={m.id} value={m.id}>
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <div className="text-muted-foreground">市场概况内容</div>
          </TabsContent>
          <TabsContent value="volatility">
            <div className="text-muted-foreground">波动率分析内容</div>
          </TabsContent>
          <TabsContent value="positions">
            <div className="text-muted-foreground">持仓结构内容</div>
          </TabsContent>
          <TabsContent value="sentiment">
            <div className="text-muted-foreground">资金情绪内容</div>
          </TabsContent>
          <TabsContent value="expiry">
            <div className="text-muted-foreground">到期分析内容</div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
