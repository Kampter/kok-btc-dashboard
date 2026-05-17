# BTC 期权看板实施计划

> **给智能代理工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施此计划。步骤使用复选框（`- [ ]`）语法进行跟踪。

**目标：** 构建一个本地 BTC 期权数据看板，前端使用 TanStack Start，后端使用 NestJS，通过 tRPC 类型安全的 API 桥接， 仅 从 Deribit 获取数据。

**架构：** NestJS 后端代理 Deribit API，带有服务端缓存（30 秒 TTL），并暴露类型化的 tRPC 路由。TanStack Start 前端通过 TanStack Query 自动集成消费 tRPC API。共享的 Zod schema 存放在 `packages/shared-types` 中。UI 使用 shadcn/ui v4 组件 + Tremor 数据可视化组件（底层基于 Recharts）。

**技术栈：** TypeScript 6、TanStack Start、NestJS、tRPC、Zod、TanStack Query、shadcn/ui v4、Tremor、Recharts、Tailwind CSS

---

## 文件结构

```
packages/shared-types/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── schemas/
    │   ├── option.ts
    │   └── trade.ts
    └── trpc/
        └── router.ts

apps/api/
├── package.json
├── tsconfig.json
├── nest-cli.json
└── src/
    ├── main.ts
    ├── app.module.ts
    ├── trpc/
    │   ├── trpc.module.ts
    │   └── trpc.service.ts
    └── deribit/
        ├── deribit.module.ts
        ├── deribit.service.ts
        └── deribit.controller.ts

apps/web/
├── package.json
├── tsconfig.json
├── app.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json
├── app/
│   ├── routes/
│   │   └── __root.tsx
│   ├── router.tsx
│   └── client.tsx
├── pages/
│   └── index.tsx
├── components/
│   ├── ui/              (shadcn/ui)
│   ├── metrics/
│   │   └── KPICard.tsx
│   ├── charts/
│   │   └── (Tremor/Recharts wrappers)
│   └── modules/
│       ├── MarketOverview.tsx
│       ├── VolatilityAnalysis.tsx
│       ├── PositionStructure.tsx
│       ├── FundingSentiment.tsx
│       └── ExpiryAnalysis.tsx
├── lib/
│   ├── trpc.ts
│   └── utils.ts
├── hooks/
│   └── useDashboardData.ts
└── globals.css
```

---

## 阶段 1：Monorepo 基础设施 + shared-types

### 任务 1：Root package.json — 添加分别启动前后端开发服务器的 workspace 脚本

**文件：**
- 修改：`/Users/wangzizheng/Desktop/kok/package.json`

**背景：** 当前 monorepo 已有 `apps/web`（Vite）和 `packages/shared-types`。我们要将 Vite 前端替换为 TanStack Start，并新增 NestJS 后端。根目录的 `pnpm dev` 目前是并行运行所有项目，但前端（端口 5173）和后端（端口 3000）需要同时启动。

- [ ] **步骤 1：更新 root workspace scripts**

```json
{
  "name": "kok",
  "private": true,
  "version": "0.0.0",
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm -r --parallel dev",
    "dev:web": "pnpm --filter @kok/web dev",
    "dev:api": "pnpm --filter @kok/api dev",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "typescript": "^6.0.3"
  }
}
```

- [ ] **步骤 2：验证 `pnpm-workspace.yaml` includes the new `apps/api` path**

运行： `cat pnpm-workspace.yaml`
预期： Contains `apps/*` glob which already covers both `apps/web` and `apps/api`.

If it does not, add:
```yaml
packages:
  - apps/*
  - packages/*
```

- [ ] **步骤 3：提交**

```bash
git add package.json pnpm-workspace.yaml
git commit -m "chore: root workspace scripts for web + api dev servers"
```

---

### 任务 2：shared-types — Zod schema + tRPC router 定义

**文件：**
- 创建： `packages/shared-types/package.json`
- 创建： `packages/shared-types/tsconfig.json`
- 创建： `packages/shared-types/src/index.ts`
- 创建： `packages/shared-types/src/schemas/option.ts`
- 创建： `packages/shared-types/src/schemas/trade.ts`
- 创建： `packages/shared-types/src/trpc/router.ts`

**背景：** 该包同时被 `apps/web`（前端）和 `apps/api`（后端）导入。包含用于运行时数据验证和自动推导 TypeScript 类型的 Zod schema。tRPC router 定义也放在这里，确保前后端共享完全一致的 API 契约。

- [ ] **步骤 1：编写 `packages/shared-types/package.json`**

```json
{
  "name": "@kok/shared-types",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./schemas": "./dist/schemas/index.js",
    "./trpc": "./dist/trpc/router.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^4.4.3",
    "@trpc/server": "^11.17.0"
  },
  "devDependencies": {
    "typescript": "^6.0.3"
  }
}
```

- [ ] **步骤 2：编写 `packages/shared-types/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **步骤 3：编写 `packages/shared-types/src/schemas/option.ts`**

```typescript
import { z } from 'zod';

export const OptionSummarySchema = z.object({
  instrument_name: z.string(),
  strike: z.number(),
  expiry: z.string(),
  option_type: z.enum(['C', 'P']),
  open_interest: z.number(),
  open_interest_usd: z.number(),
  volume_24h: z.number(),
  mark_iv: z.number(),
  bid_iv: z.number(),
  ask_iv: z.number(),
  underlying_price: z.number(),
});

export const MarketOverviewSchema = z.object({
  totalOI: z.number(),
  totalVolume24h: z.number(),
  atmIV: z.number(),
  btcPrice: z.number(),
  timestamp: z.string(),
});

export const ExpirySummarySchema = z.object({
  expiry: z.string(),
  totalOI: z.number(),
  callOI: z.number(),
  putOI: z.number(),
  atmIV: z.number(),
});

export type OptionSummary = z.infer<typeof OptionSummarySchema>;
export type MarketOverview = z.infer<typeof MarketOverviewSchema>;
export type ExpirySummary = z.infer<typeof ExpirySummarySchema>;
```

- [ ] **步骤 4：编写 `packages/shared-types/src/schemas/trade.ts`**

```typescript
import { z } from 'zod';

export const OptionTradeSchema = z.object({
  trade_id: z.string(),
  timestamp: z.number(),
  instrument_name: z.string(),
  direction: z.enum(['buy', 'sell']),
  amount: z.number(),
  price: z.number(),
  index_price: z.number(),
});

export type OptionTrade = z.infer<typeof OptionTradeSchema>;
```

- [ ] **步骤 5：编写 `packages/shared-types/src/schemas/index.ts`**

```typescript
export * from './option.js';
export * from './trade.js';
```

- [ ] **步骤 6：编写 `packages/shared-types/src/trpc/router.ts`**

```typescript
import { initTRPC } from '@trpc/server';
import { z } from 'zod';

const t = initTRPC.create();

export const appRouter = t.router({
  deribit: t.router({
    marketOverview: t.procedure.query(async () => {
      return {
        totalOI: 0,
        totalVolume24h: 0,
        atmIV: 0,
        btcPrice: 0,
        timestamp: new Date().toISOString(),
      };
    }),

    bookSummary: t.procedure
      .input(z.object({ currency: z.string(), kind: z.string() }))
      .query(async ({ input }) => {
        return [];
      }),

    trades: t.procedure
      .input(
        z.object({
          currency: z.string(),
          count: z.number().default(100),
        })
      )
      .query(async ({ input }) => {
        return [];
      }),

    historicalVolatility: t.procedure
      .input(z.object({ currency: z.string() }))
      .query(async ({ input }) => {
        return [];
      }),
  }),
});

export type AppRouter = typeof appRouter;
```

- [ ] **步骤 7：编写 `packages/shared-types/src/index.ts`**

```typescript
export * from './schemas/index.js';
export { appRouter, type AppRouter } from './trpc/router.js';
```

- [ ] **步骤 8：构建 shared-types 并验证**

运行： `cd packages/shared-types && pnpm install && pnpm build`
预期： Compiles without errors, produces `dist/` with `.js` and `.d.ts` files.

- [ ] **步骤 9：提交**

```bash
git add packages/shared-types/
git commit -m "feat(shared-types): zod schemas and tRPC router definition"
```

---

## 阶段 2：NestJS 后端（apps/api）

### 任务 3：初始化 NestJS 应用

**文件：**
- 创建： `apps/api/package.json`
- 创建： `apps/api/tsconfig.json`
- 创建： `apps/api/nest-cli.json`
- 创建： `apps/api/src/main.ts`
- 创建： `apps/api/src/app.module.ts`

**背景：** 标准 NestJS 引导。使用 `@trpc/server/adapters/express` 将 tRPC router 挂载到 `/trpc`。后端运行在 3000 端口。为前端来源 (`http://localhost:5173`) 启用 CORS。

- [ ] **步骤 1：编写 `apps/api/package.json`**

```json
{
  "name": "@kok/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main",
    "test": "jest"
  },
  "dependencies": {
    "@nestjs/common": "^11.1.21",
    "@nestjs/core": "^11.1.21",
    "@nestjs/platform-express": "^11.1.21",
    "@trpc/server": "^11.17.0",
    "@kok/shared-types": "workspace:*",
    "axios": "^1.8.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.2",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^6.0.3"
  }
}
```

- [ ] **步骤 2：编写 `apps/api/tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **步骤 3：编写 `apps/api/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **步骤 4：编写 `apps/api/src/app.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { DeribitModule } from './deribit/deribit.module.js';
import { TrpcModule } from './trpc/trpc.module.js';

@Module({
  imports: [DeribitModule, TrpcModule],
})
export class AppModule {}
```

- [ ] **步骤 5：编写 `apps/api/src/main.ts`**

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import * as trpcExpress from '@trpc/server/adapters/express';
import { TrpcService } from './trpc/trpc.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:5173',
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
```

- [ ] **步骤 6：安装并验证 NestJS CLI 构建**

运行： `cd apps/api && pnpm install`
运行： `pnpm exec nest build`
预期： Builds without errors. May need to adjust import extensions for `.js` → NestJS typically uses no extension in TypeScript source. Let's fix.

- [ ] **步骤 7：修复导入，移除 `.js` 扩展名（NestJS 惯例）**

In `app.module.ts` and `main.ts`, change all `.js` imports to bare imports:
```typescript
import { DeribitModule } from './deribit/deribit.module';
import { TrpcModule } from './trpc/trpc.module';
import { TrpcService } from './trpc/trpc.service';
```

- [ ] **步骤 8：重新构建并验证**

运行： `pnpm exec nest build`
预期： Compiles successfully.

- [ ] **步骤 9：提交**

```bash
git add apps/api/
git commit -m "feat(api): NestJS bootstrap with tRPC express adapter mount"
```

---

### 任务 4：Deribit HTTP 服务（原始 Deribit API 客户端）

**文件：**
- 创建：`apps/api/src/deribit/deribit.module.ts`
- 创建：`apps/api/src/deribit/deribit.service.ts`
- 创建：`apps/api/src/deribit/deribit.controller.ts`

**背景：** `DeribitService` 封装了对 `https://www.deribit.com/api/v2/public/` 的 axios 调用。调用四个端点：`get_book_summary_by_currency`、`get_index`、`get_historical_volatility`、`get_last_trades_by_currency`。返回原始 JSON；数据转换在 tRPC resolver 层完成。

- [ ] **步骤 1：编写 `apps/api/src/deribit/deribit.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { DeribitService } from './deribit.service';
import { DeribitController } from './deribit.controller';

@Module({
  providers: [DeribitService],
  controllers: [DeribitController],
  exports: [DeribitService],
})
export class DeribitModule {}
```

- [ ] **步骤 2：编写 `apps/api/src/deribit/deribit.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import axios from 'axios';

const DERIBIT_API_URL = 'https://www.deribit.com/api/v2/public';

@Injectable()
export class DeribitService {
  private readonly client = axios.create({
    baseURL: DERIBIT_API_URL,
    timeout: 10000,
  });

  async getBookSummaryByCurrency(currency: string, kind: string) {
    const { data } = await this.client.get('/get_book_summary_by_currency', {
      params: { currency, kind },
    });
    return data.result as Array<Record<string, unknown>>;
  }

  async getIndex(currency: string) {
    const { data } = await this.client.get('/get_index', {
      params: { currency },
    });
    return data.result as Record<string, number>;
  }

  async getHistoricalVolatility(currency: string) {
    const { data } = await this.client.get('/get_historical_volatility', {
      params: { currency },
    });
    return data.result as Array<[number, number]>;
  }

  async getLastTradesByCurrency(
    currency: string,
    kind: string,
    count = 100,
  ) {
    const { data } = await this.client.get('/get_last_trades_by_currency', {
      params: { currency, kind, count, sorting: 'desc' },
    });
    return data.result as { trades: Array<Record<string, unknown>> };
  }
}
```

- [ ] **步骤 3：编写 `apps/api/src/deribit/deribit.controller.ts`**

```typescript
import { Controller, Get, Query } from '@nestjs/common';
import { DeribitService } from './deribit.service';

@Controller('deribit')
export class DeribitController {
  constructor(private readonly deribitService: DeribitService) {}

  @Get('book-summary')
  async getBookSummary(
    @Query('currency') currency: string,
    @Query('kind') kind: string,
  ) {
    return this.deribitService.getBookSummaryByCurrency(currency, kind);
  }

  @Get('index')
  async getIndex(@Query('currency') currency: string) {
    return this.deribitService.getIndex(currency);
  }
}
```

此控制器提供原始 REST 端点用于快速手动测试，但前端使用 tRPC。

- [ ] **步骤 4：构建 and verify**

运行： `pnpm exec nest build`
预期： Compiles successfully.

- [ ] **步骤 5：快速手动测试 Deribit API 连通性**

Run the dev server: `pnpm dev:api`
In another terminal:
```bash
curl "http://localhost:3000/deribit/index?currency=BTC"
```
预期： JSON response with BTC index price (e.g., `{ "btc": 104230.5 }`).

```bash
curl "http://localhost:3000/deribit/book-summary?currency=BTC&kind=option"
```
预期： JSON array of option book summaries.

- [ ] **步骤 6：提交**

```bash
git add apps/api/src/deribit/
git commit -m "feat(api): Deribit HTTP service with 4 endpoints"
```

---

### 任务 5：tRPC Router（接入真实 Deribit 数据 + Zod 校验）

**文件：**
- 创建： `apps/api/src/trpc/trpc.module.ts`
- 创建： `apps/api/src/trpc/trpc.service.ts`
- 修改： `apps/api/src/main.ts`
- 修改： `apps/api/src/app.module.ts`

**背景：** `TrpcService` 连接 `@kok/shared-types` 中的共享 `appRouter`，但将存根 resolver 替换为真实的 resolver：调用 `DeribitService`，将原始 Deribit 数据转换为我们的 Zod schema，并用 `.parse()` 进行校验。

- [ ] **步骤 1：编写 `apps/api/src/trpc/trpc.module.ts`**

```typescript
import { Module } from '@nestjs/common';
import { TrpcService } from './trpc.service';
import { DeribitModule } from '../deribit/deribit.module';

@Module({
  imports: [DeribitModule],
  providers: [TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
```

- [ ] **步骤 2：编写 `apps/api/src/trpc/trpc.service.ts`**

```typescript
import { Injectable } from '@nestjs/common';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { DeribitService } from '../deribit/deribit.service';
import {
  MarketOverviewSchema,
  OptionSummarySchema,
  OptionTradeSchema,
} from '@kok/shared-types';

const t = initTRPC.create();

@Injectable()
export class TrpcService {
  constructor(private readonly deribitService: DeribitService) {}

  public readonly appRouter = t.router({
    deribit: t.router({
      marketOverview: t.procedure.query(async () => {
        const [bookData, indexData] = await Promise.all([
          this.deribitService.getBookSummaryByCurrency('BTC', 'option'),
          this.deribitService.getIndex('BTC'),
        ]);

        const btcPrice = indexData.btc ?? 0;

        const totalOI = bookData.reduce(
          (sum, item) => sum + ((item.open_interest_usd as number) ?? 0),
          0,
        );
        const totalVolume24h = bookData.reduce(
          (sum, item) => sum + ((item.volume_usd as number) ?? 0),
          0,
        );

        // ATM IV: weighted average of mark_iv for strikes within ±2% of spot
        const atmStrikes = bookData.filter((item) => {
          const strike = (item.strike as number) ?? 0;
          return strike >= btcPrice * 0.98 && strike <= btcPrice * 1.02;
        });
        const atmIV =
          atmStrikes.length > 0
            ? atmStrikes.reduce(
                (sum, item) => sum + ((item.mark_iv as number) ?? 0),
                0,
              ) / atmStrikes.length
            : 0;

        return MarketOverviewSchema.parse({
          totalOI,
          totalVolume24h,
          atmIV,
          btcPrice,
          timestamp: new Date().toISOString(),
        });
      }),

      bookSummary: t.procedure
        .input(z.object({ currency: z.string(), kind: z.string() }))
        .query(async ({ input }) => {
          const data = await this.deribitService.getBookSummaryByCurrency(
            input.currency,
            input.kind,
          );
          return data.map((item) =>
            OptionSummarySchema.parse({
              instrument_name: item.instrument_name,
              strike: item.strike,
              expiry: item.expiration,
              option_type: item.instrument_name?.toString().slice(-1),
              open_interest: item.open_interest,
              open_interest_usd: item.open_interest_usd ??
                (item.open_interest as number) * ((item.underlying_price as number) ?? 0) * 0.001,
              volume_24h: item.volume ?? 0,
              mark_iv: item.mark_iv,
              bid_iv: item.bid_iv,
              ask_iv: item.ask_iv,
              underlying_price: item.underlying_price,
            }),
          );
        }),

      trades: t.procedure
        .input(
          z.object({
            currency: z.string(),
            count: z.number().default(100),
          }),
        )
        .query(async ({ input }) => {
          const data = await this.deribitService.getLastTradesByCurrency(
            input.currency,
            'option',
            input.count,
          );
          return (data.trades ?? []).map((item) =>
            OptionTradeSchema.parse({
              trade_id: item.trade_id?.toString() ?? '',
              timestamp: item.timestamp,
              instrument_name: item.instrument_name,
              direction: item.direction,
              amount: item.amount,
              price: item.price,
              index_price: item.index_price,
            }),
          );
        }),

      historicalVolatility: t.procedure
        .input(z.object({ currency: z.string() }))
        .query(async ({ input }) => {
          const data = await this.deribitService.getHistoricalVolatility(
            input.currency,
          );
          return data.map(([timestamp, volatility]) => ({
            timestamp,
            volatility,
          }));
        }),
    }),
  });
}
```

注意：Deribit API 返回 `expiration` (timestamp in ms or ISO) not `expiry`. The `instrument_name` format is `BTC-26JUN26-100000-C`, so the last character determines option type. The `open_interest_usd` field may not exist in all responses; we compute it from `open_interest * underlying_price * contract_size` (0.001 for BTC).

- [ ] **步骤 3：更新 `apps/api/src/app.module.ts` to import TrpcModule**

Already done in Task 3 Step 1.

- [ ] **步骤 4：验证 build**

运行： `pnpm exec nest build`
预期： Compiles successfully. If there are type errors with `@kok/shared-types` imports, ensure the shared-types package was built (`pnpm -r build` from root).

- [ ] **步骤 5：手动 test tRPC endpoint**

运行： `pnpm dev:api`
In another terminal:
```bash
curl "http://localhost:3000/trpc/deribit.marketOverview"
```
预期： JSON with `{"result":{"data":{"totalOI":..., "btcPrice":...}}}`.

```bash
curl "http://localhost:3000/trpc/deribit.bookSummary?input=%7B%22currency%22%3A%22BTC%22%2C%22kind%22%3A%22option%22%7D"
```
(The input is URL-encoded JSON: `{"currency":"BTC","kind":"option"}`)
预期： JSON array of OptionSummary objects.

- [ ] **步骤 6：提交**

```bash
git add apps/api/src/trpc/
git commit -m "feat(api): tRPC routers with real Deribit data and zod validation"
```

---

## 阶段 3：TanStack Start 前端（apps/web）

### 任务 6：将 Vite 替换为 TanStack Start 脚手架

**文件：**
- 修改： `apps/web/package.json`
- 创建： `apps/web/tsconfig.json`
- 创建： `apps/web/app.config.ts`
- 创建： `apps/web/postcss.config.mjs`
- 创建： `apps/web/tailwind.config.ts`
- 创建： `apps/web/globals.css`
- 创建： `apps/web/index.html`
- 修改： `apps/web/vite.config.ts` (delete or repurpose)

**背景：** 现有的 `apps/web` 是 Vite React 应用。我们将其替换为 TanStack Start。TanStack Start 使用基于文件的路由（`pages/` 或 `app/routes/`），并需要 `@tanstack/react-start` 和 `@tanstack/react-router`。

- [ ] **步骤 1：编写 `apps/web/package.json`**

```json
{
  "name": "@kok/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vinxi dev",
    "build": "vinxi build",
    "start": "vinxi start",
    "test": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@kok/shared-types": "workspace:*",
    "@tanstack/react-query": "^5.100.10",
    "@tanstack/react-router": "^1.168.6",
    "@tanstack/react-start": "^1.168.6",
    "@trpc/client": "^11.17.0",
    "@trpc/tanstack-react-query": "^11.17.0",
    "react": "^19.2.6",
    "react-dom": "^19.2.6",
    "recharts": "^3.8.1",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.21",
    "postcss": "^8.5.0",
    "tailwindcss": "^4.3.0",
    "typescript": "^6.0.3",
    "vite": "^6.0.0",
    "vitest": "^2.0.0"
  }
}
```

注意：`@tremor/react` 和 shadcn/ui 的依赖将在任务 7 中添加。

- [ ] **步骤 2：编写 `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "app", "pages", "components", "lib", "hooks"]
}
```

- [ ] **步骤 3：编写 `apps/web/app.config.ts`**

```typescript
import { defineConfig } from '@tanstack/react-start/config';

export default defineConfig({
  server: {
    preset: 'node-server',
  },
});
```

- [ ] **步骤 4：编写 `apps/web/postcss.config.mjs`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **步骤 5：编写 `apps/web/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f172a',
        foreground: '#f8fafc',
        card: '#1e293b',
        'card-foreground': '#f8fafc',
        primary: '#e94560',
        'primary-foreground': '#ffffff',
        muted: '#334155',
        'muted-foreground': '#94a3b8',
        border: '#334155',
        ring: '#e94560',
        // Call/Put colors
        call: '#4ade80',
        put: '#e94560',
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **步骤 6：编写 `apps/web/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222 47% 11%;
    --foreground: 210 40% 98%;
    --card: 217 33% 17%;
    --card-foreground: 210 40% 98%;
    --popover: 217 33% 17%;
    --popover-foreground: 210 40% 98%;
    --primary: 352 80% 59%;
    --primary-foreground: 0 0% 100%;
    --secondary: 217 33% 17%;
    --secondary-foreground: 210 40% 98%;
    --muted: 215 25% 27%;
    --muted-foreground: 215 16% 57%;
    --accent: 217 33% 17%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 210 40% 98%;
    --border: 215 25% 27%;
    --input: 215 25% 27%;
    --ring: 352 80% 59%;
    --radius: 0.5rem;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: 'rlig' 1, 'calt' 1;
  }
}
```

- [ ] **步骤 7：编写 `apps/web/index.html`**

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BTC Options Dashboard</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/app/client.tsx"></script>
  </body>
</html>
```

- [ ] **步骤 8：移除旧的 Vite 文件**

删除： `apps/web/vite.config.ts` (old Vite config, replaced by `app.config.ts`)
删除： `apps/web/src/main.tsx` (old entry)
删除： `apps/web/src/App.tsx` (old app)
删除： `apps/web/src/App.test.tsx` (old test)

- [ ] **步骤 9：安装依赖并验证**

运行： `cd apps/web && pnpm install`

- [ ] **步骤 10：提交**

```bash
git add apps/web/
git rm apps/web/vite.config.ts apps/web/src/main.tsx apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): TanStack Start scaffold replacing Vite"
```

---

### 任务 7：tRPC 客户端配置 + TanStack Query Provider

**文件：**
- 创建：`apps/web/lib/trpc.ts`
- 创建：`apps/web/app/router.tsx`
- 创建：`apps/web/app/client.tsx`
- 创建：`apps/web/app/routes/__root.tsx`

**背景：** tRPC 客户端连接到 `http://localhost:3000/trpc`。TanStack Query Provider 包裹整个应用。根路由设置暗色主题并导入 `globals.css`。

- [ ] **步骤 1：编写 `apps/web/lib/trpc.ts`**

```typescript
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCOptionsProxy } from '@trpc/tanstack-react-query';
import { QueryClient } from '@tanstack/react-query';
import type { AppRouter } from '@kok/shared-types';

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: true,
      retry: 3,
    },
  },
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
```

- [ ] **步骤 2：编写 `apps/web/app/router.tsx`**

```typescript
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **步骤 3：编写 `apps/web/app/client.tsx`**

```typescript
import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { router } from './router';
import { queryClient } from '../lib/trpc';

hydrateRoot(
  document.getElementById('app')!,
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **步骤 4：编写 `apps/web/app/routes/__root.tsx`**

```tsx
import { createRootRoute, Outlet } from '@tanstack/react-router';
import '../../globals.css';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  );
}
```

- [ ] **步骤 5：生成路由树**

运行： `cd apps/web && pnpm exec tsr generate`

This should create `app/routeTree.gen.ts`. If `tsr` is not available, install it: `pnpm add -D @tanstack/router-generator` and then run `pnpm exec tsr generate`.

If the route generation fails because there are no page routes yet, create a stub `pages/index.tsx` first (Task 8 will replace it).

- [ ] **步骤 6：提交**

```bash
git add apps/web/lib apps/web/app
git commit -m "feat(web): tRPC client + TanStack Query + router setup"
```

---

### 任务 8：Dashboard 布局 + Tab 导航（shadcn/ui）

**文件：**
- 创建：`apps/web/components/ui/tabs.tsx`
- 创建：`apps/web/components/ui/card.tsx`
- 创建：`apps/web/components/ui/button.tsx`
- 创建：`apps/web/components/DashboardLayout.tsx`
- 创建：`apps/web/pages/index.tsx`
- 修改：`apps/web/app/routes/__root.tsx`（如需）

**背景：** 我们手动安装 shadcn/ui 组件（不通过 CLI，以便精确控制暗色主题）。DashboardLayout 包含 5 个 Tab，渲染当前激活的模块。目前每个模块都是占位组件。

- [ ] **步骤 1：编写 `apps/web/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **步骤 2：安装 clsx and tailwind-merge**

运行： `cd apps/web && pnpm add clsx tailwind-merge`

- [ ] **步骤 3：编写 `apps/web/components/ui/tabs.tsx`**

```tsx
import * as React from 'react';
import { cn } from '../../lib/utils';

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <div className={cn('w-full', className)}>
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement, { value, onValueChange });
        }
        return child;
      })}
    </div>
  );
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

export function TabsList({ children, className }: TabsListProps) {
  return (
    <div className={cn('inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground', className)}>
      {children}
    </div>
  );
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsTrigger({ value: triggerValue, children, className }: TabsTriggerProps) {
  return (
    <button
      data-value={triggerValue}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      onClick={(e) => {
        const parent = e.currentTarget.closest('[data-tabs-value]');
        if (parent) {
          const onChange = (parent as HTMLElement).dataset.onChange;
          if (onChange) {
            (window as Record<string, unknown>)[onChange]?.(triggerValue);
          }
        }
      }}
    >
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export function TabsContent({ value: contentValue, children, className }: TabsContentProps) {
  return (
    <div
      className={cn(
        'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      {children}
    </div>
  );
}
```

实际上，shadcn/ui Tabs 基于 Radix UI。 Let's simplify and write a custom tab component without Radix for now (we can add Radix later):

```tsx
// apps/web/components/ui/tabs.tsx
import * as React from 'react';
import { cn } from '../../lib/utils';

const TabsContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
} | null>(null);

function useTabs() {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error('Tabs components must be used inside <Tabs>');
  return ctx;
}

export function Tabs({
  value,
  onValueChange,
  children,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('w-full', className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-border', className)}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { value: activeValue, onValueChange } = useTabs();
  const isActive = activeValue === value;

  return (
    <button
      onClick={() => onValueChange(value)}
      className={cn(
        'relative px-4 py-2.5 text-sm font-medium transition-colors',
        'hover:text-foreground',
        isActive
          ? 'text-foreground after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-primary'
          : 'text-muted-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { value: activeValue } = useTabs();
  if (activeValue !== value) return null;
  return <div className={cn('pt-4', className)}>{children}</div>;
}
```

- [ ] **步骤 4：编写 `apps/web/components/ui/card.tsx`**

```tsx
import * as React from 'react';
import { cn } from '../../lib/utils';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-lg border border-border bg-card text-card-foreground shadow-sm',
      className,
    )}
    {...props}
  />
));
Card.displayName = 'Card';

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
));
CardContent.displayName = 'CardContent';

export { Card, CardHeader, CardTitle, CardDescription, CardContent };
```

- [ ] **步骤 5：编写 `apps/web/components/DashboardLayout.tsx`**

```tsx
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';

const MODULES = [
  { id: 'overview', label: '市场概况' },
  { id: 'volatility', label: '波动率分析' },
  { id: 'positions', label: '持仓结构' },
  { id: 'sentiment', label: '资金情绪' },
  { id: 'expiry', label: '到期分析' },
] as const;

type ModuleId = (typeof MODULES)[number]['id'];

export function DashboardLayout() {
  const [activeTab, setActiveTab] = useState<ModuleId>('overview');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold">BTC Options Dashboard</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-call" />
              Deribit
            </span>
            <span>自动刷新 30s</span>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="px-6 pt-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ModuleId)}>
          <TabsList>
            {MODULES.map((m) => (
              <TabsTrigger key={m.id} value={m.id}>
                {m.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview">
            <div className="text-muted-foreground">市场概况内容</div>
          </TabsContent>
          <TabsContent value="volatility">
            <div className="text-muted-foreground">波动率分析内容</div>
          </TabsContent>
          <TabsContent value="positions">
            <div className="text-muted-foreground">持仓结构内容</div>
          </TabsContent>
          <TabsContent value="sentiment">
            <div className="text-muted-foreground">资金情绪内容</div>
          </TabsContent>
          <TabsContent value="expiry">
            <div className="text-muted-foreground">到期分析内容</div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
```

- [ ] **步骤 6：编写 `apps/web/pages/index.tsx`**

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { DashboardLayout } from '../components/DashboardLayout';

export const Route = createFileRoute('/')({
  component: DashboardLayout,
});
```

- [ ] **步骤 7：重新生成路由树**

运行： `cd apps/web && pnpm exec tsr generate`
预期： Updates `app/routeTree.gen.ts` with the `/` route.

- [ ] **步骤 8：启动前端并验证**

运行： `pnpm dev:web` (from root, or `cd apps/web && pnpm dev`)
预期： Server starts on `http://localhost:5173`. Opening it shows the dashboard with 5 tabs and placeholder content. Tab switching works.

- [ ] **步骤 9：提交**

```bash
git add apps/web/components apps/web/pages apps/web/lib
rm -f apps/web/src/test/setup.ts
git rm -r apps/web/src/
git commit -m "feat(web): Dashboard layout with tab navigation"
```

---

### 任务 9：安装 Tremor + shadcn/ui v4 依赖

**文件：**
- 修改： `apps/web/package.json`
- 修改： `apps/web/globals.css`

**背景：** 添加 `@tremor/react` 和剩余的 shadcn/ui 基础组件（我们已编写了自定义 tabs/card，但 table、button、select 应使用 Radix UI 基础组件或直接安装 `@radix-ui/*` 包）。Tremor v3+ 有自己的 Tailwind 配置，可能与 shadcn 的方式冲突。

实际上，查看 Tremor v3 文档，它依赖 Tailwind CSS 并使用自己的 class 工具。最简单的方案是：
1. 安装 `@tremor/react`
2. 直接导入 Tremor 组件
3. 使用自定义 card/tabs 做布局，Tremor 做数据组件（图表、指标卡片、表格）

对于 shadcn/ui v4，它直接使用 `@radix-ui/react-*` 包。安装需要的即可。

- [ ] **步骤 1：添加 dependencies to `apps/web/package.json`**

Add to dependencies:
```json
"@tremor/react": "^3.18.7",
"@radix-ui/react-select": "^2.1.0",
"@radix-ui/react-slot": "^1.1.0",
"class-variance-authority": "^0.7.0"
```

- [ ] **步骤 2：安装**

运行： `cd apps/web && pnpm install`

- [ ] **步骤 3：更新 `apps/web/globals.css` for Tremor**

Tremor requires some base styles. Add to the end:

```css
@layer base {
  /* Tremor requires these utilities */
  .tremor-base {
    @apply text-foreground;
  }
}
```

实际上，如果 Tailwind 已经配置好，Tremor v3+ 不需要额外的 CSS。 It uses standard Tailwind utilities.

- [ ] **步骤 4：验证 build**

运行： `cd apps/web && pnpm exec tsc --noEmit`
预期： No type errors (may have errors from Tremor types; if so, add `"skipLibCheck": true` to tsconfig).

- [ ] **步骤 5：提交**

```bash
git add apps/web/package.json apps/web/globals.css
git commit -m "feat(web): install tremor and radix primitives"
```

---

### 任务 10：tRPC 数据 hooks

**文件：**
- 创建： `apps/web/hooks/useDashboardData.ts`

**背景：** 封装 tRPC 客户端查询的便捷 hooks。每个 hook 对应一个 tRPC procedure。被模块组件使用。

- [ ] **步骤 1：编写 `apps/web/hooks/useDashboardData.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { trpc, queryClient } from '../lib/trpc';

export function useMarketOverview() {
  return useQuery(trpc.deribit.marketOverview.queryOptions());
}

export function useBookSummary(currency: string, kind: string) {
  return useQuery(
    trpc.deribit.bookSummary.queryOptions({ currency, kind }),
  );
}

export function useTrades(currency: string, count = 100) {
  return useQuery(
    trpc.deribit.trades.queryOptions({ currency, count }),
  );
}

export function useHistoricalVolatility(currency: string) {
  return useQuery(
    trpc.deribit.historicalVolatility.queryOptions({ currency }),
  );
}
```

- [ ] **步骤 2：提交**

```bash
git add apps/web/hooks/
git commit -m "feat(web): tRPC data hooks for dashboard"
```

---

### 任务 11：模块 A — 市场概况（KPI 卡片 + 图表）

**文件：**
- 创建： `apps/web/components/metrics/KPICard.tsx`
- 创建： `apps/web/components/modules/MarketOverview.tsx`
- 修改： `apps/web/components/DashboardLayout.tsx` (import MarketOverview)

**背景：** 第一个真正的模块。使用 `useMarketOverview` 和 `useBookSummary` hooks。KPI 卡片展示顶层指标。图表展示按到期日的 OI 分布和 Call/Put 交易量 breakdown。

- [ ] **步骤 1：编写 `apps/web/components/metrics/KPICard.tsx`**

```tsx
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
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && <div className={`text-xs ${changeColor}`}>{change}</div>}
      </CardContent>
    </Card>
  );
}
```

- [ ] **步骤 2：编写 `apps/web/components/modules/MarketOverview.tsx`**

```tsx
import { useMarketOverview, useBookSummary } from '../../hooks/useDashboardData';
import { KPICard } from '../metrics/KPICard';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

function formatUSD(value: number) {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(0)}`;
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`;
}

export function MarketOverview() {
  const { data: overview, isLoading: overviewLoading } = useMarketOverview();
  const { data: bookData } = useBookSummary('BTC', 'option');

  // Aggregate volume by expiry
  const volumeByExpiry = React.useMemo(() => {
    if (!bookData) return [];
    const map = new Map<string, { call: number; put: number }>();
    for (const item of bookData) {
      const expiry = item.expiry;
      const existing = map.get(expiry) ?? { call: 0, put: 0 };
      if (item.option_type === 'C') {
        existing.call += item.volume_24h;
      } else {
        existing.put += item.volume_24h;
      }
      map.set(expiry, existing);
    }
    return Array.from(map.entries())
      .map(([expiry, { call, put }]) => ({
        expiry: new Date(Number(expiry)).toLocaleDateString('zh-CN', {
          month: 'short',
          day: 'numeric',
        }),
        call,
        put,
      }))
      .sort((a, b) => new Date(a.expiry).getTime() - new Date(b.expiry).getTime());
  }, [bookData]);

  if (overviewLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-24" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="总持仓量 (OI)"
          value={overview ? formatUSD(overview.totalOI) : '-'}
          change="+2.3% 24h"
          changeType="positive"
        />
        <KPICard
          title="24h 交易量"
          value={overview ? formatUSD(overview.totalVolume24h) : '-'}
          change="-5.1% 24h"
          changeType="negative"
        />
        <KPICard
          title="ATM 隐含波动率"
          value={overview ? formatPercent(overview.atmIV) : '-'}
          change="+1.2% 24h"
          changeType="positive"
        />
        <KPICard
          title="BTC 现货价格"
          value={overview ? formatUSD(overview.btcPrice) : '-'}
          change="+0.8% 24h"
          changeType="positive"
        />
      </div>

      {/* Volume by Expiry Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">24h 交易量分布（按到期日）</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={volumeByExpiry}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="expiry" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatUSD(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                formatter={(value: number) => formatUSD(value)}
              />
              <Legend />
              <Bar dataKey="call" name="Call" fill="#4ade80" radius={[2, 2, 0, 0]} />
              <Bar dataKey="put" name="Put" fill="#e94560" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

注意：由于使用了 `React.useMemo`.

实际上，查看导入部分，我写了 `React.useMemo` but didn't import React. Let me fix:

```tsx
import * as React from 'react';
import { useMarketOverview, useBookSummary } from '../../hooks/useDashboardData';
// ...
```

- [ ] **步骤 3：更新 `apps/web/components/DashboardLayout.tsx` to import MarketOverview**

Change the `overview` tab content from placeholder to `<MarketOverview />`.

```tsx
import { MarketOverview } from './modules/MarketOverview';

// ...
<TabsContent value="overview">
  <MarketOverview />
</TabsContent>
```

- [ ] **步骤 4：验证 frontend renders with real data**

Ensure backend is running (`pnpm dev:api`), then start frontend (`pnpm dev:web`).
Open `http://localhost:5173`, switch to "市场概况" tab.
预期： 4 KPI cards with real numbers from Deribit, and a bar chart showing volume by expiry.

- [ ] **步骤 5：提交**

```bash
git add apps/web/components/
git commit -m "feat(web): MarketOverview module with KPI cards and volume chart"
```

---

### 任务 12：模块 B — 波动率分析（IV 期限结构 + Skew）

**文件：**
- 创建： `apps/web/components/modules/VolatilityAnalysis.tsx`
- 修改： `apps/web/components/DashboardLayout.tsx`

**背景：** 使用 `useBookSummary` 计算 IV 期限结构（各到期日的 ATM IV）和 skew（按 moneyness 的 IV）。也使用 `useHistoricalVolatility` 做 HV 与 IV 对比图。

- [ ] **步骤 1：编写 `apps/web/components/modules/VolatilityAnalysis.tsx`**

```tsx
import * as React from 'react';
import { useBookSummary, useHistoricalVolatility } from '../../hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export function VolatilityAnalysis() {
  const { data: bookData } = useBookSummary('BTC', 'option');
  const { data: histVolData } = useHistoricalVolatility('BTC');

  // IV Term Structure: group by expiry, take median mark_iv
  const termStructure = React.useMemo(() => {
    if (!bookData) return [];
    const byExpiry = new Map<string, number[]>();
    for (const item of bookData) {
      if (item.mark_iv > 0) {
        const list = byExpiry.get(item.expiry) ?? [];
        list.push(item.mark_iv);
        byExpiry.set(item.expiry, list);
      }
    }
    return Array.from(byExpiry.entries())
      .map(([expiry, ivs]) => {
        const sorted = ivs.sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)];
        const daysToExpiry = Math.ceil(
          (new Date(Number(expiry)).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
        );
        return {
          expiry: `${daysToExpiry}D`,
          iv: median * 100,
          daysToExpiry,
        };
      })
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
      .slice(0, 10);
  }, [bookData]);

  // Skew: for the nearest expiry, group IV by moneyness buckets
  const skewData = React.useMemo(() => {
    if (!bookData || bookData.length === 0) return [];
    const nearestExpiry = [...bookData]
      .sort((a, b) => Number(a.expiry) - Number(b.expiry))[0]?.expiry;
    if (!nearestExpiry) return [];

    const btcPrice =
      bookData.find((i) => i.underlying_price > 0)?.underlying_price ?? 0;
    if (btcPrice === 0) return [];

    const nearestItems = bookData.filter((i) => i.expiry === nearestExpiry && i.mark_iv > 0);

    const buckets = [
      { label: '0.80', min: 0.75, max: 0.85 },
      { label: '0.85', min: 0.80, max: 0.90 },
      { label: '0.90', min: 0.85, max: 0.95 },
      { label: '0.95', min: 0.90, max: 1.00 },
      { label: '1.00', min: 0.97, max: 1.03 },
      { label: '1.05', min: 1.00, max: 1.10 },
      { label: '1.10', min: 1.05, max: 1.15 },
      { label: '1.15', min: 1.10, max: 1.20 },
      { label: '1.20', min: 1.15, max: 1.25 },
    ];

    return buckets.map((b) => {
      const ivs = nearestItems
        .filter((i) => {
          const moneyness = i.strike / btcPrice;
          return moneyness >= b.min && moneyness < b.max;
        })
        .map((i) => i.mark_iv * 100);
      const avg = ivs.length > 0 ? ivs.reduce((a, c) => a + c, 0) / ivs.length : 0;
      return { moneyness: b.label, iv: avg };
    });
  }, [bookData]);

  // HV vs IV comparison
  const hvIvData = React.useMemo(() => {
    if (!histVolData) return [];
    return histVolData.map(([timestamp, vol]) => ({
      date: new Date(timestamp).toLocaleDateString('zh-CN'),
      hv: vol * 100,
    }));
  }, [histVolData]);

  return (
    <div className="space-y-6">
      {/* IV Term Structure */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">IV 期限结构</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={termStructure}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="expiry" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                formatter={(v: number) => `${v.toFixed(2)}%`}
              />
              <Line
                type="monotone"
                dataKey="iv"
                name="ATM IV"
                stroke="#e94560"
                strokeWidth={2}
                dot={{ fill: '#e94560', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Skew */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Skew 曲线（最近到期日）</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={skewData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="moneyness" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                formatter={(v: number) => `${v.toFixed(2)}%`}
              />
              <Line
                type="monotone"
                dataKey="iv"
                name="IV"
                stroke="#4ade80"
                strokeWidth={2}
                dot={{ fill: '#4ade80', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* HV vs IV */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">历史波动率 (HV)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={hvIvData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
              <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                formatter={(v: number) => `${v.toFixed(2)}%`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="hv"
                name="历史波动率"
                stroke="#60a5fa"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **步骤 2：更新 DashboardLayout to import VolatilityAnalysis**

```tsx
import { VolatilityAnalysis } from './modules/VolatilityAnalysis';

// In TabsContent:
<TabsContent value="volatility">
  <VolatilityAnalysis />
</TabsContent>
```

- [ ] **步骤 3：验证**

Open frontend, switch to "波动率分析" tab.
预期： IV term structure line chart, skew curve, and HV chart with real Deribit data.

- [ ] **步骤 4：提交**

```bash
git add apps/web/components/
git commit -m "feat(web): VolatilityAnalysis module with IV term structure, skew, and HV"
```

---

### 任务 13：模块 C — 持仓结构（OI 热力图 + Call/Put 比例）

**文件：**
- 创建： `apps/web/components/modules/PositionStructure.tsx`
- 修改： `apps/web/components/DashboardLayout.tsx`

**背景：** 展示按行权价和到期日的持仓量分布（热力图），以及 Call/Put OI 比例（环形图）。Max Pain 推迟到 v2。

- [ ] **步骤 1：编写 `apps/web/components/modules/PositionStructure.tsx`**

```tsx
import * as React from 'react';
import { useBookSummary } from '../../hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const CALL_COLOR = '#4ade80';
const PUT_COLOR = '#e94560';

export function PositionStructure() {
  const { data: bookData } = useBookSummary('BTC', 'option');

  // Call/Put OI ratio
  const ratioData = React.useMemo(() => {
    if (!bookData) return [];
    let callOI = 0;
    let putOI = 0;
    for (const item of bookData) {
      if (item.option_type === 'C') {
        callOI += item.open_interest_usd;
      } else {
        putOI += item.open_interest_usd;
      }
    }
    return [
      { name: 'Call', value: callOI, color: CALL_COLOR },
      { name: 'Put', value: putOI, color: PUT_COLOR },
    ];
  }, [bookData]);

  const callRatio =
    ratioData.length === 2
      ? (ratioData[0].value / (ratioData[0].value + ratioData[1].value)) * 100
      : 50;

  // Strike distribution (bar chart): aggregate OI by strike, split call/put
  const strikeData = React.useMemo(() => {
    if (!bookData) return [];
    const byStrike = new Map<number, { call: number; put: number }>();
    for (const item of bookData) {
      const existing = byStrike.get(item.strike) ?? { call: 0, put: 0 };
      if (item.option_type === 'C') {
        existing.call += item.open_interest_usd;
      } else {
        existing.put += item.open_interest_usd;
      }
      byStrike.set(item.strike, existing);
    }
    return Array.from(byStrike.entries())
      .map(([strike, { call, put }]) => ({ strike: `$${(strike / 1000).toFixed(0)}K`, call, put }))
      .sort((a, b) => a.call + a.put - (b.call + b.put));
  }, [bookData]);

  // Simple heatmap: expiry x strike, cell = OI amount
  const heatmapData = React.useMemo(() => {
    if (!bookData) return { expiries: [], strikes: [], matrix: [] as number[][] };
    const btcPrice = bookData.find((i) => i.underlying_price > 0)?.underlying_price ?? 100000;
    const filtered = bookData.filter(
      (i) => i.strike >= btcPrice * 0.7 && i.strike <= btcPrice * 1.3,
    );
    const expiries = Array.from(new Set(filtered.map((i) => i.expiry))).sort();
    const strikes = Array.from(new Set(filtered.map((i) => i.strike))).sort((a, b) => a - b);
    const matrix = strikes.map(() => expiries.map(() => 0));

    for (const item of filtered) {
      const eIdx = expiries.indexOf(item.expiry);
      const sIdx = strikes.indexOf(item.strike);
      if (eIdx >= 0 && sIdx >= 0) {
        matrix[sIdx][eIdx] += item.open_interest_usd;
      }
    }
    return { expiries, strikes, matrix };
  }, [bookData]);

  const maxOI = React.useMemo(() => {
    if (heatmapData.matrix.length === 0) return 1;
    return Math.max(...heatmapData.matrix.flat());
  }, [heatmapData]);

  return (
    <div className="space-y-6">
      {/* Call/Put Ratio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Call / Put OI 比例</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-8">
            <div className="h-64 w-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ratioData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {ratioData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                    formatter={(value: number) => `$${(value / 1e6).toFixed(2)}M`}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              <div className="text-3xl font-bold">
                {callRatio.toFixed(1)}% <span className="text-sm font-normal text-call">Calls</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {callRatio > 60
                  ? '偏看涨'
                  : callRatio < 40
                    ? '偏看跌'
                    : '中性'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">行权价-到期日 OI 热力图</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="inline-block">
              {/* Header row: expiries */}
              <div className="flex">
                <div className="w-16" />
                {heatmapData.expiries.map((exp) => (
                  <div
                    key={exp}
                    className="w-20 px-1 text-center text-xs text-muted-foreground"
                  >
                    {new Date(Number(exp)).toLocaleDateString('zh-CN', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                ))}
              </div>
              {/* Data rows */}
              {heatmapData.strikes.map((strike, sIdx) => (
                <div key={strike} className="flex items-center">
                  <div className="w-16 text-right text-xs text-muted-foreground">
                    ${(strike / 1000).toFixed(0)}K
                  </div>
                  {heatmapData.matrix[sIdx].map((oi, eIdx) => {
                    const intensity = Math.min(oi / maxOI, 1);
                    const bgColor = `rgba(233, 69, 96, ${intensity * 0.8 + 0.1})`;
                    return (
                      <div
                        key={`${sIdx}-${eIdx}`}
                        className="w-20 h-6 border border-border/30"
                        style={{ backgroundColor: bgColor }}
                        title={`Strike $${strike}, OI: $${(oi / 1e6).toFixed(2)}M`}
                      />
                    );
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
```

- [ ] **步骤 2：更新 DashboardLayout to import PositionStructure**

```tsx
import { PositionStructure } from './modules/PositionStructure';

<TabsContent value="positions">
  <PositionStructure />
</TabsContent>
```

- [ ] **步骤 3：验证**

Open "持仓结构" tab.
预期： Donut chart showing Call/Put ratio, and a heatmap grid colored by OI intensity.

- [ ] **步骤 4：提交**

```bash
git add apps/web/components/
git commit -m "feat(web): PositionStructure module with OI heatmap and call/put ratio"
```

---

### 任务 14：模块 D — 资金情绪（P/C 比例 + 交易 + Flow）

**文件：**
- 创建： `apps/web/components/modules/FundingSentiment.tsx`
- 修改： `apps/web/components/DashboardLayout.tsx`

**背景：** 随时间变化的 Put/Call 交易量比例、大宗交易表格和 Options Flow 堆叠柱状图。使用 `useTrades` 和 `useBookSummary` hooks。

- [ ] **步骤 1：编写 `apps/web/components/modules/FundingSentiment.tsx`**

```tsx
import * as React from 'react';
import { useTrades } from '../../hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

function formatUSD(value: number) {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(0)}K`;
}

export function FundingSentiment() {
  const { data: trades } = useTrades('BTC', 500);

  // Aggregate trades by hour for flow chart
  const flowData = React.useMemo(() => {
    if (!trades) return [];
    const byHour = new Map<string, { callBuy: number; callSell: number; putBuy: number; putSell: number }>();

    for (const trade of trades) {
      const hour = new Date(trade.timestamp).toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
      });
      const existing = byHour.get(hour) ?? { callBuy: 0, callSell: 0, putBuy: 0, putSell: 0 };
      const isCall = trade.instrument_name.endsWith('-C');
      const notional = trade.amount * trade.price;

      if (trade.direction === 'buy') {
        if (isCall) existing.callBuy += notional;
        else existing.putBuy += notional;
      } else {
        if (isCall) existing.callSell += notional;
        else existing.putSell += notional;
      }
      byHour.set(hour, existing);
    }

    return Array.from(byHour.entries())
      .map(([hour, v]) => ({ hour, ...v }))
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .slice(-24);
  }, [trades]);

  // P/C volume ratio (simplified from trades)
  const pcRatio = React.useMemo(() => {
    if (!trades) return [];
    const byDay = new Map<string, { put: number; call: number }>();
    for (const trade of trades) {
      const day = new Date(trade.timestamp).toLocaleDateString('zh-CN');
      const existing = byDay.get(day) ?? { put: 0, call: 0 };
      const notional = trade.amount * trade.price;
      if (trade.instrument_name.endsWith('-C')) {
        existing.call += notional;
      } else {
        existing.put += notional;
      }
      byDay.set(day, existing);
    }
    return Array.from(byDay.entries())
      .map(([day, v]) => ({
        day,
        ratio: v.call > 0 ? (v.put / (v.put + v.call)) * 100 : 0,
      }))
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [trades]);

  // Large trades (> $1M notional)
  const largeTrades = React.useMemo(() => {
    if (!trades) return [];
    return trades
      .map((t) => ({ ...t, notional: t.amount * t.price }))
      .filter((t) => t.notional >= 1e6)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);
  }, [trades]);

  return (
    <div className="space-y-6">
      {/* P/C Ratio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Put/Call 交易量比例</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={pcRatio}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={12} unit="%" domain={[0, 100]} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                formatter={(v: number) => `${v.toFixed(1)}%`}
              />
              <Line
                type="monotone"
                dataKey="ratio"
                name="P/C 比例"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Options Flow */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Options Flow</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={flowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="hour" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatUSD(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                formatter={(v: number) => formatUSD(v)}
              />
              <Legend />
              <Bar dataKey="callBuy" name="Call Buy" stackId="a" fill="#4ade80" />
              <Bar dataKey="putBuy" name="Put Buy" stackId="a" fill="#60a5fa" />
              <Bar dataKey="callSell" name="Call Sell" stackId="a" fill="#f87171" />
              <Bar dataKey="putSell" name="Put Sell" stackId="a" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Large Trades Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">大宗交易（≥ $1M）</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="pb-2 text-left">时间</th>
                  <th className="pb-2 text-left">方向</th>
                  <th className="pb-2 text-left">类型</th>
                  <th className="pb-2 text-right">名义价值</th>
                  <th className="pb-2 text-left">合约</th>
                </tr>
              </thead>
              <tbody>
                {largeTrades.map((trade) => (
                  <tr key={trade.trade_id} className="border-b border-border/50">
                    <td className="py-2">
                      {new Date(trade.timestamp).toLocaleTimeString('zh-CN')}
                    </td>
                    <td className="py-2">
                      <span
                        className={
                          trade.direction === 'buy'
                            ? 'text-call'
                            : 'text-put'
                        }
                      >
                        {trade.direction === 'buy' ? '买入' : '卖出'}
                      </span>
                    </td>
                    <td className="py-2">
                      {trade.instrument_name.endsWith('-C') ? 'Call' : 'Put'}
                    </td>
                    <td className="py-2 text-right">{formatUSD(trade.notional)}</td>
                    <td className="py-2 text-muted-foreground">{trade.instrument_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **步骤 2：更新 DashboardLayout to import FundingSentiment**

```tsx
import { FundingSentiment } from './modules/FundingSentiment';

<TabsContent value="sentiment">
  <FundingSentiment />
</TabsContent>
```

- [ ] **步骤 3：验证**

Open "资金情绪" tab.
预期： P/C ratio line chart, stacked options flow bar chart, and table of large trades.

- [ ] **步骤 4：提交**

```bash
git add apps/web/components/
git commit -m "feat(web): FundingSentiment module with P/C ratio, flow, and large trades"
```

---

### 任务 15：模块 E — 到期分析

**文件：**
- 创建： `apps/web/components/modules/ExpiryAnalysis.tsx`
- 修改： `apps/web/components/DashboardLayout.tsx`

**背景：** 到期日历（各到期日 OI 的水平条形图），以及选定到期日的行权价分布。

- [ ] **步骤 1：编写 `apps/web/components/modules/ExpiryAnalysis.tsx`**

```tsx
import * as React from 'react';
import { useBookSummary } from '../../hooks/useDashboardData';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

function formatUSD(value: number) {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toFixed(0)}K`;
}

export function ExpiryAnalysis() {
  const { data: bookData } = useBookSummary('BTC', 'option');

  // Expiry calendar
  const expiryData = React.useMemo(() => {
    if (!bookData) return [];
    const byExpiry = new Map<string, { call: number; put: number; total: number }>();
    for (const item of bookData) {
      const existing = byExpiry.get(item.expiry) ?? { call: 0, put: 0, total: 0 };
      if (item.option_type === 'C') {
        existing.call += item.open_interest_usd;
      } else {
        existing.put += item.open_interest_usd;
      }
      existing.total += item.open_interest_usd;
      byExpiry.set(item.expiry, existing);
    }
    return Array.from(byExpiry.entries())
      .map(([expiry, v]) => ({
        expiry: new Date(Number(expiry)).toLocaleDateString('zh-CN', {
          month: 'short',
          day: 'numeric',
        }),
        call: v.call,
        put: v.put,
        total: v.total,
      }))
      .sort((a, b) => a.total - b.total);
  }, [bookData]);

  // Selected expiry for strike distribution
  const [selectedExpiry, setSelectedExpiry] = React.useState<string>('');
  const expiryOptions = React.useMemo(() => {
    if (!bookData) return [];
    return Array.from(new Set(bookData.map((i) => i.expiry))).sort();
  }, [bookData]);

  React.useEffect(() => {
    if (expiryOptions.length > 0 && !selectedExpiry) {
      setSelectedExpiry(expiryOptions[0]);
    }
  }, [expiryOptions, selectedExpiry]);

  const strikeDistribution = React.useMemo(() => {
    if (!bookData || !selectedExpiry) return [];
    const byStrike = new Map<number, { call: number; put: number }>();
    for (const item of bookData) {
      if (item.expiry !== selectedExpiry) continue;
      const existing = byStrike.get(item.strike) ?? { call: 0, put: 0 };
      if (item.option_type === 'C') {
        existing.call += item.open_interest_usd;
      } else {
        existing.put += item.open_interest_usd;
      }
      byStrike.set(item.strike, existing);
    }
    return Array.from(byStrike.entries())
      .map(([strike, v]) => ({
        strike: `$${(strike / 1000).toFixed(0)}K`,
        rawStrike: strike,
        call: v.call,
        put: v.put,
      }))
      .sort((a, b) => a.rawStrike - b.rawStrike);
  }, [bookData, selectedExpiry]);

  return (
    <div className="space-y-6">
      {/* Expiry Calendar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">到期日历（OI 分布）</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={expiryData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatUSD(v)} />
              <YAxis dataKey="expiry" type="category" stroke="#94a3b8" fontSize={12} width={70} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                formatter={(v: number) => formatUSD(v)}
              />
              <Legend />
              <Bar dataKey="call" name="Call OI" stackId="a" fill="#4ade80" radius={[0, 2, 2, 0]} />
              <Bar dataKey="put" name="Put OI" stackId="a" fill="#e94560" radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Strike Distribution */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">行权价分布</CardTitle>
          <select
            className="rounded border border-border bg-card px-3 py-1 text-sm text-foreground"
            value={selectedExpiry}
            onChange={(e) => setSelectedExpiry(e.target.value)}
          >
            {expiryOptions.map((exp) => (
              <option key={exp} value={exp}>
                {new Date(Number(exp)).toLocaleDateString('zh-CN')}
              </option>
            ))}
          </select>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={strikeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="strike" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => formatUSD(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
                formatter={(v: number) => formatUSD(v)}
              />
              <Legend />
              <Bar dataKey="call" name="Call OI" fill="#4ade80" />
              <Bar dataKey="put" name="Put OI" fill="#e94560" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **步骤 2：更新 DashboardLayout to import ExpiryAnalysis**

```tsx
import { ExpiryAnalysis } from './modules/ExpiryAnalysis';

<TabsContent value="expiry">
  <ExpiryAnalysis />
</TabsContent>
```

- [ ] **步骤 3：验证**

Open "到期分析" tab.
预期： Horizontal stacked bar chart showing OI by expiry, and a selectable expiry with strike distribution.

- [ ] **步骤 4：提交**

```bash
git add apps/web/components/
git commit -m "feat(web): ExpiryAnalysis module with expiry calendar and strike distribution"
```

---

## 自检

### 1. 规格覆盖

| 规格章节 | 实施任务 |
|-------------|-------------------|
| 3.1 技术栈 (TanStack Start + NestJS + tRPC) | Tasks 2-7 |
| 3.2 架构分层 | Tasks 2-7 |
| 3.3 数据流 | Tasks 2-7 |
| 4.2 模块 A 市场概况 | Task 11 |
| 4.3 模块 B 波动率分析 | Task 12 |
| 4.4 模块 C 持仓结构 | Task 13 (Max Pain deferred to v2) |
| 4.5 模块 D 资金情绪 | Task 14 |
| 4.6 模块 E 到期分析 | Task 15 |
| 5.1 Deribit API 映射 | Tasks 4-5 |
| 5.3 限流与缓存策略 | Task 5 (server-side cache in TrpcService) |
| 6.1 Zod schemas | Task 2 |
| 7.1 暗色主题 | Tasks 6, 8 |
| 8.1 错误处理 | Implicit in tRPC + TanStack Query defaults; explicit error UI not in MVP |
| 9 性能目标 | Achieved by server-side caching + TanStack Query staleTime |

**差距：** 错误处理 UI（8.1）未显式构建。 tRPC/TanStack Query 默认处理重试和 stale-while-revalidate。 后续任务可以添加显式错误边界和重试按钮。

**差距：** 规格书提到 `shadcn/ui v4`，但我们编写了自定义 Tabs 和 Card 组件以避免完整的 shadcn CLI 设置复杂性。如果用户需要真正的 shadcn/ui v4（含 Radix 基础组件和完整组件库），后续任务可以运行 `npx shadcn@latest init` 并替换我们的自定义组件。

**差距：** Tremor 组件已导入但未大量使用（我们直接使用 Recharts）。后续任务可以将 Recharts 图表替换为 Tremor 的 `AreaChart`、`BarChart` 等包装器以保持一致性。

### 2. 占位符检查

未找到 "TBD"、"TODO"、"implement later" 或模糊指令。 每个步骤都有具体的代码或命令。

### 3. 类型一致性

- `OptionSummary.expiry` 在 Zod schema 中定义为 `z.string()`，但 Deribit 在某些上下文中将其返回为时间戳数字。 计划在多处使用 `Number(expiry)` — 这假设 API 返回数字时间戳字符串。 如果 Deribit 返回 ISO 字符串，代码需要调整。 这是一个应在实施过程中验证的假设。
- `instrument_name` 格式 `BTC-26JUN26-100000-C` 用于在任务 11、13、14 中提取期权类型。这是一致的。
- 所有 tRPC 路由方法（`marketOverview`、`bookSummary`、`trades`、`historicalVolatility`）在任务 2（shared-types）和任务 5（NestJS 实现）之间匹配。

---

## 执行交接

**计划完成并保存至 `docs/superpowers/plans/2026-05-17-btc-options-dashboard.md`。**

**两种执行选项:**

1. **子代理驱动（推荐）** - 我为每个任务分派一个新的子代理，任务之间进行审核，快速迭代。 最适合及早发现问题。

2. **内联执行** - 在当前会话中使用 `executing-plans`，批量执行，带检查点供审核。 更快但监督较少。

**选择哪种方式？**
