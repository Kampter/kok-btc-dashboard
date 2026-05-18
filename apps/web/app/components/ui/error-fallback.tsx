import { Card, CardContent, CardHeader, CardTitle } from './card';

interface ErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorFallback({
  title = '数据加载失败',
  message = '无法获取最新数据，请稍后重试',
  onRetry,
}: ErrorFallbackProps) {
  return (
    <Card className="border-put/30">
      <CardHeader>
        <CardTitle className="text-base text-put">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            重试
          </button>
        )}
      </CardContent>
    </Card>
  );
}
