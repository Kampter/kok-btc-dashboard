import * as React from 'react';
import { useBookSummary, useHistoricalVolatility } from '../../hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ErrorFallback } from '../ui/error-fallback';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function VolatilityAnalysis() {
  const { data: bookData, isLoading: bookLoading, isError: bookError, refetch: refetchBook } = useBookSummary('BTC', 'option');
  const { data: histVolData, isLoading: hvLoading, isError: hvError, refetch: refetchHv } = useHistoricalVolatility('BTC');

  const termStructure = React.useMemo(() => {
    if (!bookData) return [];
    const byExpiry = new Map<string, number[]>();
    for (const item of bookData) {
      if (item.mark_iv > 0) {
        const list = byExpiry.get(item.expiry) ?? [];
        list.push(item.mark_iv);
        byExpiry.set(item.expiry, list);
      }
    }
    return Array.from(byExpiry.entries())
      .map(([expiry, ivs]) => {
        const sorted = ivs.sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const daysToExpiry = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return { expiry: `${daysToExpiry}D`, iv: median, daysToExpiry };
      })
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
      .slice(0, 10);
  }, [bookData]);

  const skewData = React.useMemo(() => {
    if (!bookData || bookData.length === 0) return [];
    const nearestExpiry = [...bookData].sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime())[0]?.expiry;
    if (!nearestExpiry) return [];
    const btcPrice = bookData.find((i) => i.underlying_price > 0)?.underlying_price ?? 0;
    if (btcPrice === 0) return [];
    const nearestItems = bookData.filter((i) => i.expiry === nearestExpiry && i.mark_iv > 0);
    const buckets = [
      { label: '0.80', min: 0.75, max: 0.85 }, { label: '0.85', min: 0.80, max: 0.90 },
      { label: '0.90', min: 0.85, max: 0.95 }, { label: '0.95', min: 0.90, max: 1.00 },
      { label: '1.00', min: 0.97, max: 1.03 }, { label: '1.05', min: 1.00, max: 1.10 },
      { label: '1.10', min: 1.05, max: 1.15 }, { label: '1.15', min: 1.10, max: 1.20 },
      { label: '1.20', min: 1.15, max: 1.25 },
    ];
    return buckets.map((b) => {
      const ivs = nearestItems
        .filter((i) => { const moneyness = i.strike / btcPrice; return moneyness >= b.min && moneyness < b.max; })
        .map((i) => i.mark_iv);
      const avg = ivs.length > 0 ? ivs.reduce((a, c) => a + c, 0) / ivs.length : 0;
      return { moneyness: b.label, iv: avg };
    });
  }, [bookData]);

  const hvIvData = React.useMemo(() => {
    if (!histVolData) return [];
    return histVolData.map((item) => ({
      date: new Date(item.timestamp).toLocaleDateString('zh-CN'),
      hv: item.volatility,
    }));
  }, [histVolData]);

  if (bookLoading || hvLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse"><CardContent className="h-64" /></Card>
        ))}
      </div>
    );
  }

  if (bookError) {
    return <ErrorFallback title="波动率分析数据加载失败" onRetry={() => refetchBook()} />;
  }

  if (hvError) {
    return <ErrorFallback title="历史波动率数据加载失败" onRetry={() => refetchHv()} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">IV 期限结构</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={termStructure}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="expiry" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={(v: unknown) => `${(v as number).toFixed(2)}%`} />
              <Line type="monotone" dataKey="iv" name="ATM IV" stroke="#e94560" strokeWidth={2} dot={{ fill: '#e94560', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Skew 曲线（最近到期日）</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={skewData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="moneyness" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={(v: unknown) => `${(v as number).toFixed(2)}%`} />
              <Line type="monotone" dataKey="iv" name="IV" stroke="#4ade80" strokeWidth={2} dot={{ fill: '#4ade80', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">历史波动率 (HV)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hvIvData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={(v: unknown) => `${(v as number).toFixed(2)}%`} />
              <Legend />
              <Line type="monotone" dataKey="hv" name="历史波动率" stroke="#60a5fa" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
