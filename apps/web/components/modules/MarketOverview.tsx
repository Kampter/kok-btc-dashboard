import * as React from 'react';
import { useMarketOverview, useBookSummary } from '../../hooks/useDashboardData';
import { KPICard } from '../metrics/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function formatUSD(value: number) {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(0)}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

export function MarketOverview() {
  const { data: overview, isLoading } = useMarketOverview();
  const { data: bookData } = useBookSummary('BTC', 'option');

  const volumeByExpiry = React.useMemo(() => {
    if (!bookData) return [];
    const map = new Map<string, { call: number; put: number }>();
    for (const item of bookData) {
      const expiry = item.expiry;
      const existing = map.get(expiry) ?? { call: 0, put: 0 };
      if (item.option_type === 'C') existing.call += item.volume_24h;
      else existing.put += item.volume_24h;
      map.set(expiry, existing);
    }
    return Array.from(map.entries())
      .map(([expiry, { call, put }]) => ({
        expiry: new Date(Number(expiry)).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        call, put,
      }))
      .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());
  }, [bookData]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse"><CardContent className="h-24" /></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard title="总持仓量 (OI)" value={overview ? formatUSD(overview.totalOI) : '-'} change="+2.3% 24h" changeType="positive" />
        <KPICard title="24h 交易量" value={overview ? formatUSD(overview.totalVolume24h) : '-'} change="-5.1% 24h" changeType="negative" />
        <KPICard title="ATM 隐含波动率" value={overview ? formatPercent(overview.atmIV) : '-'} change="+1.2% 24h" changeType="positive" />
        <KPICard title="BTC 现货价格" value={overview ? formatUSD(overview.btcPrice) : '-'} change="+0.8% 24h" changeType="positive" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">24h 交易量分布（按到期日）</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={volumeByExpiry}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="expiry" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatUSD(v)} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={(value: number) => formatUSD(value)} />
              <Legend />
              <Bar dataKey="call" name="Call" fill="#4ade80" radius={[2, 2, 0, 0]} />
              <Bar dataKey="put" name="Put" fill="#e94560" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
