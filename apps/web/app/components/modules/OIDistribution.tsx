import * as React from 'react';
import { useOIDistribution } from '../../hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ErrorFallback } from '../ui/error-fallback';
import { formatUSD } from '../../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const CALL_COLOR = '#4ade80';
const PUT_COLOR = '#e94560';

interface ChartRow {
  strike: string;
  rawStrike: number;
  call_oi: number;
  put_oi: number;
}

function formatStrike(strike: number): string {
  return `$${(strike / 1000).toFixed(0)}K`;
}

export function OIDistribution() {
  // First call: get list of expiries + default selected data
  const {
    data: listData,
    isLoading: listLoading,
    isError: listError,
    refetch: refetchList,
  } = useOIDistribution('BTC');

  const [selectedExpiry, setSelectedExpiry] = React.useState<string>('');

  // Set default selected expiry from list
  React.useEffect(() => {
    if (listData?.expiries && listData.expiries.length > 0 && !selectedExpiry) {
      setSelectedExpiry(listData.expiries[0].expiry);
    }
  }, [listData, selectedExpiry]);

  // Second call: get data for selected expiry
  const {
    data: expiryData,
    isLoading: expiryLoading,
    isError: expiryError,
    refetch: refetchExpiry,
  } = useOIDistribution('BTC', selectedExpiry || undefined, !!selectedExpiry);

  const isLoading = listLoading || expiryLoading;
  const isError = listError || expiryError;

  const distribution = expiryData?.selected ?? listData?.selected;

  const chartData: ChartRow[] = React.useMemo(() => {
    if (!distribution) return [];
    return distribution.strike_distribution
      .map((item) => ({
        strike: formatStrike(item.strike),
        rawStrike: item.strike,
        call_oi: -item.call_oi_usd,
        put_oi: item.put_oi_usd,
      }))
      .sort((a, b) => a.rawStrike - b.rawStrike);
  }, [distribution]);

  const handleRetry = () => {
    refetchList();
    if (selectedExpiry) refetchExpiry();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="h-16" />
        </Card>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-24" />
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="h-96" />
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorFallback
        title="OI 分布数据加载失败"
        onRetry={handleRetry}
      />
    );
  }

  if (!listData?.expiries || listData.expiries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          暂无足够持仓数据的到期日
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Expiry Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">到期日选择</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="rounded border border-border bg-card px-3 py-2 text-sm text-foreground"
            value={selectedExpiry}
            onChange={(e) => setSelectedExpiry(e.target.value)}
          >
            {listData.expiries.map((exp) => (
              <option key={exp.expiry} value={exp.expiry}>
                {new Date(exp.expiry).toLocaleDateString('zh-CN')} ({exp.days_to_expiry} 天)
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {/* Metrics Cards */}
      {distribution && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                阻力位置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-call">
                {formatUSD(distribution.resistance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Call OI 加权中心
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                支撑位置
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-put">
                {formatUSD(distribution.support)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Put OI 加权中心
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Max Pain
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {formatUSD(distribution.max_pain)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                买方损失最大点
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Butterfly Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">行权价 OI 分布（蝴蝶图）</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={500}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20 }}>
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
                <Bar dataKey="call_oi" name="Call OI" fill={CALL_COLOR} radius={[0, 2, 2, 0]} />
                <Bar dataKey="put_oi" name="Put OI" fill={PUT_COLOR} radius={[2, 0, 0, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
