import * as React from 'react';
import { useTrades } from '../../hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ErrorFallback } from '../ui/error-fallback';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

function formatUSD(value: number) {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(0)}K`;
}

export function FundingSentiment() {
  const { data: trades, isLoading, isError, refetch } = useTrades('BTC', 500);

  const flowData = React.useMemo(() => {
    if (!trades) return [];
    const byHour = new Map<string, { callBuy: number; callSell: number; putBuy: number; putSell: number }>();
    for (const trade of trades) {
      const hour = new Date(trade.timestamp).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit' });
      const existing = byHour.get(hour) ?? { callBuy: 0, callSell: 0, putBuy: 0, putSell: 0 };
      const isCall = trade.option_type === 'C';
      const notional = trade.amount * trade.price;
      if (trade.direction === 'buy') { if (isCall) existing.callBuy += notional; else existing.putBuy += notional; }
      else { if (isCall) existing.callSell += notional; else existing.putSell += notional; }
      byHour.set(hour, existing);
    }
    return Array.from(byHour.entries()).map(([hour, v]) => ({ hour, ...v })).sort((a, b) => a.hour.localeCompare(b.hour)).slice(-24);
  }, [trades]);

  const pcRatio = React.useMemo(() => {
    if (!trades) return [];
    const byDay = new Map<string, { put: number; call: number }>();
    for (const trade of trades) {
      const day = new Date(trade.timestamp).toLocaleDateString('zh-CN');
      const existing = byDay.get(day) ?? { put: 0, call: 0 };
      const notional = trade.amount * trade.price;
      if (trade.option_type === 'C') existing.call += notional;
      else existing.put += notional;
      byDay.set(day, existing);
    }
    return Array.from(byDay.entries()).map(([day, v]) => ({
      day,
      ratio: v.call > 0 ? (v.put / (v.put + v.call)) * 100 : 0,
    })).sort((a, b) => a.day.localeCompare(b.day));
  }, [trades]);

  const largeTrades = React.useMemo(() => {
    if (!trades) return [];
    return trades.map((t) => ({ ...t, notional: t.amount * t.price })).filter((t) => t.notional >= 1e6).sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
  }, [trades]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse"><CardContent className="h-48" /></Card>
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorFallback title="资金情绪数据加载失败" onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Put/Call 交易量比例</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={pcRatio}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={12} unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={(v: unknown) => `${(v as number).toFixed(1)}%`} />
              <Line type="monotone" dataKey="ratio" name="P/C 比例" stroke="#f59e0b" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Options Flow</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={flowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatUSD(v)} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={(v: unknown) => formatUSD(v as number)} />
              <Legend />
              <Bar dataKey="callBuy" name="Call Buy" stackId="a" fill="#4ade80" />
              <Bar dataKey="putBuy" name="Put Buy" stackId="a" fill="#60a5fa" />
              <Bar dataKey="callSell" name="Call Sell" stackId="a" fill="#f87171" />
              <Bar dataKey="putSell" name="Put Sell" stackId="a" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">大宗交易（≥ $1M）</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 text-left">时间</th><th className="pb-2 text-left">方向</th>
                  <th className="pb-2 text-left">类型</th><th className="pb-2 text-right">名义价值</th>
                  <th className="pb-2 text-left">合约</th>
                </tr>
              </thead>
              <tbody>
                {largeTrades.map((trade) => (
                  <tr key={trade.trade_id} className="border-b border-border/50">
                    <td className="py-2">{new Date(trade.timestamp).toLocaleTimeString('zh-CN')}</td>
                    <td className="py-2"><span className={trade.direction === 'buy' ? 'text-call' : 'text-put'}>{trade.direction === 'buy' ? '买入' : '卖出'}</span></td>
                    <td className="py-2">{trade.option_type === 'C' ? 'Call' : 'Put'}</td>
                    <td className="py-2 text-right">{formatUSD(trade.notional)}</td>
                    <td className="py-2 text-muted-foreground">{trade.instrument_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
