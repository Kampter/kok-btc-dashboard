# 代码审查检查清单

本清单用于在提交 PR 前自查，避免常见的 monorepo 维护问题。

---

## 新增/修改依赖时

- [ ] **测试模块是否更新了 provider 注册**
  - 如果 NestJS service 新增注入依赖（如 `GreeksService`），测试中的 `Test.createTestingModule` 必须同步添加该 provider
  - 若依赖本身还有子依赖（如 `CACHE_MANAGER`），一并提供 mock

- [ ] **类型路径是否可达**
  - monorepo 包间引用（`@kok/shared-types`）需要先 `pnpm build` 生成 `dist/`
  - `pnpm typecheck` 全量通过后再提交

- [ ] **环境变量名是否全局一致**
  - 业务代码读取的变量名 = 测试 stub 的变量名 = 文档中声明的变量名
  - 重命名时全局搜索替换，不要遗漏测试文件

---

## 修改业务逻辑时

- [ ] **测试数据是否与真实公式对齐**
  - mock 数据的注释（如 "low OI, should be filtered out"）必须按实际业务公式验证
  - 示例：OI USD = OI × underlying_price × multiplier，$10,000 × 90,000 = $900M 并非 "low"

- [ ] **异常处理路径是否被覆盖**
  - 构造函数抛异常 vs 方法内 yield error 是两种行为，测试要对应
  - 若将异常检查延迟到方法调用时，测试也要从 `expect(() => new X()).toThrow()` 改为验证方法行为

---

## 提交前必跑命令

```bash
pnpm build        # 确保 dist/ 生成，包间引用可达
pnpm typecheck    # 全量 TypeScript 类型检查
pnpm test:run     # 全量测试（不是只跑单个文件）
pnpm lint         # 代码风格
```

> CI 已配置 `pnpm build && pnpm typecheck && pnpm test:run && pnpm lint` 卡点，本地先跑通再推。
