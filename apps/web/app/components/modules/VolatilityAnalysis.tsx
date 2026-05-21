import * as React from 'react';
import { useBookSummary, useHistoricalVolatility } from '../../hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ErrorFallback } from '../ui/error-fallback';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, ReferenceLine } from 'recharts';
import { groupByTenor, calculate25DeltaSkew, calculateATMIV } from '../../lib/volatility';

export function VolatilityAnalysis() {
  const { data: bookData, isLoading: bookLoading, isError: bookError, refetch: refetchBook } = useBookSummary('BTC', 'option');
  const { data: histVolData, isLoading: hvLoading, isError: hvError, refetch: refetchHv } = useHistoricalVolatility('BTC');

  const groupedByTenor = React.useMemo(() =>
    bookData && bookData.length > 0 ? groupByTenor(bookData) : new Map(),
    [bookData],
  );

  const skew25Delta = React.useMemo(() => {
    if (groupedByTenor.size === 0) return [];
    const tenors = ['1M', '3M', '6M'] as const;
    return tenors.map((tenor) => {
      const items = groupedByTenor.get(tenor);
      const skew = items ? calculate25DeltaSkew(items) : null;
      return {
        tenor,
        skew: skew ?? 0,
        hasData: skew !== null,
      };
    }).filter((d) => d.hasData);
  }, [groupedByTenor]);

  const termStructure = React.useMemo(() => {
    if (groupedByTenor.size === 0) return [];
    const tenors = ['1M', '3M', '6M'] as const;
    return tenors.map((tenor) => {
      const items = groupedByTenor.get(tenor);
      const iv = items ? calculateATMIV(items) : null;
      return {
        tenor,
        iv: iv ?? 0,
        hasData: iv !== null,
      };
    }).filter((d) => d.hasData);
  }, [groupedByTenor]);

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
        <CardHeader><CardTitle className="text-base">25Δ Skew（按期限）</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={skew25Delta}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="tenor" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                formatter={(v: unknown) => `${(v as number).toFixed(2)}%`}
                labelFormatter={(l: unknown) => `期限: ${l}`}
              />
              <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
              <Bar dataKey="skew" name="25Δ Skew" fill="#4ade80" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">
            Skew = IV(Put) − IV(Call)，取 ±0.25 Delta。正值 = 市场恐惧看跌，负值 = 市场乐观看涨。
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">ATM IV 期限结构</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={termStructure}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="tenor" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                formatter={(v: unknown) => `${(v as number).toFixed(2)}%`}
                labelFormatter={(l: unknown) => `期限: ${l}`}
              />
              <Line type="monotone" dataKey="iv" name="ATM IV" stroke="#e94560" strokeWidth={2} dot={{ fill: '#e94560', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-xs text-muted-foreground mt-2">
            每个期限取最接近 ATM（±0.50 Delta）期权的 mark_iv。
          </p>
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
