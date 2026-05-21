import * as React from 'react';
import { useGreeksExposure } from '../../hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ErrorFallback } from '../ui/error-fallback';
import { formatUSD } from '../../lib/utils';
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const CALL_COLOR = '#4ade80';
const PUT_COLOR = '#e94560';
const NET_COLOR = '#fbbf24';

interface GexChartRow {
  strike: string;
  rawStrike: number;
  call_gex: number;
  put_gex: number;
  net_gex: number;
}

interface DexChartRow {
  strike: string;
  rawStrike: number;
  call_delta: number;
  put_delta: number;
}

function formatStrike(strike: number): string {
  return `$${(strike / 1000).toFixed(0)}K`;
}

export function GreeksDashboard() {
  const { data, isLoading, isError, refetch } = useGreeksExposure('BTC');

  const gexData: GexChartRow[] = React.useMemo(() => {
    if (!data?.by_strike) return [];
    return data.by_strike
      .map((item) => ({
        strike: formatStrike(item.strike),
        rawStrike: item.strike,
        call_gex: -item.call_gex,
        put_gex: item.put_gex,
        net_gex: -item.call_gex + item.put_gex,
      }))
      .sort((a, b) => a.rawStrike - b.rawStrike);
  }, [data]);

  const dexData: DexChartRow[] = React.useMemo(() => {
    if (!data?.by_strike) return [];
    return data.by_strike
      .map((item) => ({
        strike: formatStrike(item.strike),
        rawStrike: item.strike,
        call_delta: -item.call_delta,
        put_delta: item.put_delta,
      }))
      .sort((a, b) => a.rawStrike - b.rawStrike);
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="h-16" />
        </Card>
        <Card className="animate-pulse">
          <CardContent className="h-96" />
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorFallback
        title="Greeks 数据加载失败"
        onRetry={() => refetch()}
      />
    );
  }

  const isComplete = data?.progress?.is_complete ?? false;
  const progress = data?.progress;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              总 GEX
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data?.total_gex ?? 0) >= 0 ? 'text-call' : 'text-put'}`}>
              {data?.total_gex ? formatUSD(data.total_gex) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {(data?.total_gex ?? 0) >= 0 ? '正 GEX（稳定）' : '负 GEX（波动）'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Call Wall
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-call">
              {data?.call_wall ? formatUSD(data.call_wall) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              最大 Gamma 阻力位
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Put Wall
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-put">
              {data?.put_wall ? formatUSD(data.put_wall) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              最大 Gamma 支撑位
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              零 Gamma 行权价
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {data?.zero_gamma_strike ? formatUSD(data.zero_gamma_strike) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              正负 Gamma 翻转点
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {!isComplete && progress && progress.total > 0 && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                />
              </div>
              <span>
                计算进度: {progress.completed}/{progress.total} 合约 (
                {Math.round((progress.completed / progress.total) * 100)}%)
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* GEX Butterfly Chart */}
      {gexData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">GEX by Strike（Gamma 暴露）</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={gexData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(v: number) => formatUSD(Math.abs(v))}
                />
                <YAxis
                  dataKey="strike"
                  type="category"
                  stroke="#94a3b8"
                  fontSize={12}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                  }}
                  formatter={(value, name) => [
                    formatUSD(Math.abs(value as number)),
                    name,
                  ]}
                />
                <Legend />
                <Bar dataKey="call_gex" name="Call GEX" fill={CALL_COLOR} radius={[0, 2, 2, 0]} />
                <Bar dataKey="put_gex" name="Put GEX" fill={PUT_COLOR} radius={[2, 0, 0, 2]} />
                <Line
                  type="monotone"
                  dataKey="net_gex"
                  name="Net GEX"
                  stroke={NET_COLOR}
                  strokeWidth={2}
                  dot={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* DEX Butterfly Chart */}
      {dexData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">DEX by Strike（Delta 暴露）</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={dexData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  fontSize={12}
                  tickFormatter={(v: number) => `${(v as number).toFixed(0)}`}
                />
                <YAxis
                  dataKey="strike"
                  type="category"
                  stroke="#94a3b8"
                  fontSize={12}
                  width={60}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                  }}
                />
                <Legend />
                <Bar dataKey="call_delta" name="Call Delta" fill={CALL_COLOR} radius={[0, 2, 2, 0]} />
                <Bar dataKey="put_delta" name="Put Delta" fill={PUT_COLOR} radius={[2, 0, 0, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
