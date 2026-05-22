import 'dotenv/config'
import { NestFactory } from '@nestjs/core';
import type { Response } from 'express';
import { AppModule } from './app.module';
import * as trpcExpress from '@trpc/server/adapters/express';
import { TrpcService } from './trpc/trpc.service';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PORT = parseInt(process.env.PORT || '3000', 10);

/** 开发环境支持 localhost 多个端口（Vite 端口被占用时会自动递增） */
const CORS_ORIGIN = process.env.NODE_ENV === 'production'
  ? FRONTEND_URL
  : [FRONTEND_URL, /^http:\/\/localhost:517[3-9]$/, /^http:\/\/localhost:518\d$/];

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: CORS_ORIGIN,
    credentials: true,
  });

  const trpcService = app.get(TrpcService);
  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: trpcService.appRouter,
    })
  );

  // Health check endpoint for CI/E2E readiness probe
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.get('/health', (_req: unknown, res: Response) => {
    res.status(200).send('ok');
  });

  await app.listen(PORT);
  console.log(`API server running on http://localhost:${PORT}`);
  console.log(`E2E_TEST=${process.env.E2E_TEST}`);
}
bootstrap();
