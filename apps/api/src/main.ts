import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as trpcExpress from '@trpc/server/adapters/express';
import { TrpcService } from './trpc/trpc.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    credentials: true,
  });

  const trpcService = app.get(TrpcService);
  app.use(
    '/trpc',
    trpcExpress.createExpressMiddleware({
      router: trpcService.appRouter,
    })
  );

  await app.listen(3000);
  console.log('API server running on http://localhost:3000');
}
bootstrap();
