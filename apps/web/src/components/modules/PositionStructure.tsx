import * as React from 'react';
import { useBookSummary } from '../../hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CALL_COLOR = '#4ade80';
const PUT_COLOR = '#e94560';

export function PositionStructure() {
  const { data: bookData } = useBookSummary('BTC', 'option');

  const ratioData = React.useMemo(() => {
    if (!bookData) return [];
    let callOI = 0, putOI = 0;
    for (const item of bookData) {
      if (item.option_type === 'C') callOI += item.open_interest_usd;
      else putOI += item.open_interest_usd;
    }
    return [
      { name: 'Call', value: callOI, color: CALL_COLOR },
      { name: 'Put', value: putOI, color: PUT_COLOR },
    ];
  }, [bookData]);

  const callRatio = ratioData.length === 2 ? (ratioData[0].value / (ratioData[0].value + ratioData[1].value)) * 100 : 50;

  const heatmapData = React.useMemo(() => {
    if (!bookData) return { expiries: [], strikes: [], matrix: [] as number[][] };
    const btcPrice = bookData.find((i) => i.underlying_price > 0)?.underlying_price ?? 100000;
    const filtered = bookData.filter((i) => i.strike >= btcPrice * 0.7 && i.strike <= btcPrice * 1.3);
    const expiries = Array.from(new Set(filtered.map((i) => i.expiry))).sort();
    const strikes = Array.from(new Set(filtered.map((i) => i.strike))).sort((a, b) => a - b);
    const matrix = strikes.map(() => expiries.map(() => 0));
    for (const item of filtered) {
      const eIdx = expiries.indexOf(item.expiry);
      const sIdx = strikes.indexOf(item.strike);
      if (eIdx >= 0 && sIdx >= 0) matrix[sIdx][eIdx] += item.open_interest_usd;
    }
    return { expiries, strikes, matrix };
  }, [bookData]);

  const maxOI = React.useMemo(() => heatmapData.matrix.length > 0 ? Math.max(...heatmapData.matrix.flat()) : 1, [heatmapData]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Call / Put OI 比例</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="h-64 w-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ratioData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {ratioData.map((entry, index) => (<Cell key={index} fill={entry.color} />))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} formatter={(value: number) => `$${(value / 1e6).toFixed(2)}M`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold">{callRatio.toFixed(1)}% <span className="text-sm font-normal text-call">Calls</span></div>
              <div className="text-sm text-muted-foreground">{callRatio > 60 ? '偏看涨' : callRatio < 40 ? '偏看跌' : '中性'}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">行权价-到期日 OI 热力图</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="inline-block">
              <div className="flex">
                <div className="w-16" />
                {heatmapData.expiries.map((exp) => (
                  <div key={exp} className="w-20 px-1 text-center text-xs text-muted-foreground">
                    {new Date(Number(exp)).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
                  </div>
                ))}
              </div>
              {heatmapData.strikes.map((strike, sIdx) => (
                <div key={strike} className="flex items-center">
                  <div className="w-16 text-right text-xs text-muted-foreground">${(strike / 1000).toFixed(0)}K</div>
                  {heatmapData.matrix[sIdx].map((oi, eIdx) => {
                    const intensity = Math.min(oi / maxOI, 1);
                    return <div key={`${sIdx}-${eIdx}`} className="w-20 h-6 border border-border/30" style={{ backgroundColor: `rgba(233, 69, 96, ${intensity * 0.8 + 0.1})` }} title={`Strike $${strike}, OI: $${(oi / 1e6).toFixed(2)}M`} />;
                  })}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
