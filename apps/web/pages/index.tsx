import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">BTC Options Dashboard</h1>
      <p className="text-muted-foreground">Dashboard 加载中...</p>
    </div>
  );
}
