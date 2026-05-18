import * as React from 'react';
import { useBookSummary } from '../../hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

function formatUSD(value: number) {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(0)}`;
}

export function ExpiryAnalysis() {
  const { data: bookData } = useBookSummary('BTC', 'option');

  const expiryData = React.useMemo(() => {
    if (!bookData) return [];
    const byExpiry = new Map<string, { call: number; put: number; total: number }>();
    for (const item of bookData) {
      const existing = byExpiry.get(item.expiry) ?? { call: 0, put: 0, total: 0 };
      if (item.option_type === 'C') existing.call += item.open_interest_usd;
      else existing.put += item.open_interest_usd;
      existing.total += item.open_interest_usd;
      byExpiry.set(item.expiry, existing);
    }
    return Array.from(byExpiry.entries())
      .map(([expiry, v]) => ({
        expiry: new Date(expiry).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
        call: v.call, put: v.put, total: v.total,
      }))
      .sort((a, b) => a.total - b.total);
  }, [bookData]);

  const [selectedExpiry, setSelectedExpiry] = React.useState<string>('');
  const expiryOptions = React.useMemo(() => {
    if (!bookData) return [];
    return Array.from(new Set(bookData.map((i) => i.expiry))).sort();
  }, [bookData]);

  React.useEffect(() => {
    if (expiryOptions.length > 0 && !selectedExpiry) setSelectedExpiry(expiryOptions[0]);
  }, [expiryOptions, selectedExpiry]);

  const strikeDistribution = React.useMemo(() => {
    if (!bookData || !selectedExpiry) return [];
    const byStrike = new Map<number, { call: number; put: number }>();
    for (const item of bookData) {
      if (item.expiry !== selectedExpiry) continue;
      const existing = byStrike.get(item.strike) ?? { call: 0, put: 0 };
      if (item.option_type === 'C') existing.call += item.open_interest_usd;
      else existing.put += item.open_interest_usd;
      byStrike.set(item.strike, existing);
    }
    return Array.from(byStrike.entries())
      .map(([strike, v]) => ({ strike: `$${(strike / 1000).toFixed(0)}K`, rawStrike: strike, call: v.call, put: v.put }))
      .sort((a, b) => a.rawStrike - b.rawStrike);
  }, [bookData, selectedExpiry]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">到期日历（OI 分布）</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={expiryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatUSD(v)} />
              <YAxis dataKey="expiry" type="category" stroke="#94a3b8" fontSize={12} width={70} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={(v: unknown) => formatUSD(v as number)} />
              <Legend />
              <Bar dataKey="call" name="Call OI" stackId="a" fill="#4ade80" radius={[0, 2, 2, 0]} />
              <Bar dataKey="put" name="Put OI" stackId="a" fill="#e94560" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">行权价分布</CardTitle>
          <select className="rounded border border-border bg-card px-3 py-1 text-sm text-foreground" value={selectedExpiry} onChange={(e) => setSelectedExpiry(e.target.value)}>
            {expiryOptions.map((exp) => (
              <option key={exp} value={exp}>{new Date(exp).toLocaleDateString('zh-CN')}</option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={strikeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="strike" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatUSD(v)} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={(v: unknown) => formatUSD(v as number)} />
              <Legend />
              <Bar dataKey="call" name="Call OI" fill="#4ade80" />
              <Bar dataKey="put" name="Put OI" fill="#e94560" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
