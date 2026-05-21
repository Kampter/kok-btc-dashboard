---
name: api-backend
description: Kok 后端架构规范（NestJS + tRPC + Deribit 代理）
---

# API 后端架构

NestJS 后端应用，代理 Deribit API，暴露类型安全的 tRPC 路由。

## App-level 命令

```bash
cd apps/api
pnpm dev              # NestJS dev + 热重载（端口 3000）
pnpm build            # 编译到 dist/
pnpm start            # 运行编译输出
pnpm test             # Vitest（unplugin-swc）
pnpm test:run         # CI 模式
pnpm typecheck        # tsc --noEmit
```

## 架构决策

### NestJS + tRPC

- tRPC router 通过 `@trpc/server/adapters/express` 挂载到 `/trpc`
- 所有 Deribit API 调用经过 30 秒内存缓存（`@nestjs/cache-manager`）
- CORS 白名单：`http://localhost:5173`（前端开发地址）

### 模块结构

```
src/
├── main.ts              # 应用入口
├── app.module.ts        # 根模块
├── trpc/
│   ├── trpc.module.ts   # tRPC 模块
│   └── trpc.service.ts  # tRPC router + resolver
└── deribit/
    ├── deribit.module.ts    # Deribit 模块
    ├── deribit.service.ts   # Deribit HTTP 客户端
    └── deribit.controller.ts # REST 调试端点（可选）
```

### 缓存策略

- 服务端缓存 TTL：30 秒
- 缓存键：API 方法 + 参数组合
- 内存存储（MVP 阶段），可替换为 Redis
