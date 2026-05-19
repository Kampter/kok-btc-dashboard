import 'dotenv/config'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as trpcExpress from '@trpc/server/adapters/express';
import { TrpcService } from './trpc/trpc.service';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PORT = parseInt(process.env.PORT || '3000', 10);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: FRONTEND_URL,
    credentials: true,
  });

  const trpcService = app.get(TrpcService);
  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: trpcService.appRouter,
    })
  );

  await app.listen(PORT);
  console.log(`API server running on http://localhost:${PORT}`);
}
bootstrap();
