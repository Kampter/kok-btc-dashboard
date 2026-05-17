import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

interface KPICardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
}

export function KPICard({ title, value, change, changeType = 'neutral' }: KPICardProps) {
  const changeColor =
    changeType === 'positive'
      ? 'text-call'
      : changeType === 'negative'
        ? 'text-put'
        : 'text-muted-foreground';

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && <div className={`text-xs ${changeColor}`}>{change}</div>}
      </CardContent>
    </Card>
  );
}
