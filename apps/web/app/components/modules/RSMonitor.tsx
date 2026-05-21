import { useState } from 'react';
import { useRSLatest, useRSChart } from '../../hooks/useDashboardData';
import { ErrorFallback } from '../ui/error-fallback';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const SIGNAL_COLORS = {
  strong: 'text-call',
  weak: 'text-put',
  neutral: 'text-muted-foreground',
} as const;

const SIGNAL_LABELS = {
  strong: '强势',
  weak: '弱势',
  neutral: '中性',
} as const;

export function RSMonitor() {
  const { data: scores, isLoading, isError, refetch } = useRSLatest();
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const { data: chartData } = useRSChart(selectedToken ?? '');

  if (isError) {
    return <ErrorFallback onRetry={() => refetch()} />;
  }

  if (isLoading || !scores) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  const formatPercent = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(2)}%`;

  return (
    <div className="space-y-6">
      {!selectedToken ? (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">相对强度排名</h3>
            <span className="text-xs text-muted-foreground">
              评分时间: {scores[0]?.scoredAt ? new Date(scores[0].scoredAt).toLocaleString('zh-CN') : '-'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="text-left py-2 px-3">排名</th>
                  <th className="text-left py-2 px-3">代币</th>
                  <th className="text-right py-2 px-3">7D vs BTC</th>
                  <th className="text-right py-2 px-3">RS Score</th>
                  <th className="text-center py-2 px-3">信号</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((score) => (
                  <tr
                    key={score.tokenSymbol}
                    className="border-b border-border/50 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedToken(score.tokenSymbol)}
                  >
                    <td className="py-2 px-3 font-mono">{score.rankPosition}</td>
                    <td className="py-2 px-3 font-medium">{score.tokenSymbol}</td>
                    <td className={`py-2 px-3 text-right ${score.btcReturn7d >= 0 ? 'text-call' : 'text-put'}`}>
                      {formatPercent(score.btcReturn7d)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono">{score.rsScore.toFixed(1)}</td>
                    <td className="py-2 px-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SIGNAL_COLORS[score.signal]}`}>
                        {SIGNAL_LABELS[score.signal]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedToken(null)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← 返回排名
            </button>
            <h3 className="text-lg font-semibold">{selectedToken} / BTC 相对强度</h3>
          </div>

          {chartData && chartData.points.length > 0 && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">价格 / BTC 比值</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.points}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        domain={['auto', 'auto']}
                        tickFormatter={(v: number) => v.toExponential(2)}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        labelFormatter={(ts) => new Date(ts).toLocaleString('zh-CN')}
                      />
                      <Line
                        type="monotone"
                        dataKey="btcRatio"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">RS Score 趋势</h4>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.points.filter((p) => p.score !== null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="timestamp"
                        tickFormatter={(ts) => new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        domain={[0, 100]}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                        labelFormatter={(ts) => new Date(ts).toLocaleString('zh-CN')}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="hsl(var(--call))"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
