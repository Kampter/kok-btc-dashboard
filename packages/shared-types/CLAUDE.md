# packages/shared-types/CLAUDE.md

前后端共享的 TypeScript 类型契约包，是数据模型的单一真相源。

## 包边界

该包同时被 `apps/web`（前端）和 `apps/api`（后端）导入：

```json
"@kok/shared-types": "workspace:*"
```

添加新 API 端点或数据模型时，**先在此包定义类型**，再在各 app 消费。

## 文件结构

```
src/
├── index.ts             # 统一导出
├── schemas/
│   ├── option.ts        # OptionSummary、MarketOverview、ExpirySummary
│   └── trade.ts         # OptionTrade
├── trpc/
│   └── router.ts        # tRPC router 定义（类型层）
└── fixtures/
    ├── raw/             # Deribit API 原始响应 fixtures
    ├── derived/         # Zod 验证后的 fixtures
    └── factories.ts     # 工厂函数
```

## Schema 规范

- 使用 Zod 定义运行时验证 + 自动推导 TypeScript 类型
- 所有 schema 导出对应的 `type X = z.infer<typeof XSchema>`
- Fixtures 必须通过 Zod 验证（见 `fixtures/consistency.test.ts`）

## TypeScript Project References

Apps 使用 composite project references（`tsconfig.json`），使 `tsc --build` 能高效检查 monorepo。当新增一个被 app 导入的包时，需要将其接入 app `tsconfig.json` 的 `references` 中。

示例：
```json
// apps/web/tsconfig.json 或 apps/api/tsconfig.json
{
  "references": [
    { "path": "../../packages/shared-types" }
  ]
}
```

## 命令

```bash
cd packages/shared-types
pnpm build            # tsc 编译到 dist/
pnpm dev              # tsc --watch
pnpm test             # Vitest
pnpm typecheck        # tsc --noEmit
```
