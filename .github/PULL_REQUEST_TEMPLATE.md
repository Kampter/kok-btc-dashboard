## 变更说明

<!-- 描述本次 PR 的主要变更 -->

## 检查清单

在提交 PR 前，请确保完成以下检查：

- [ ] `pnpm typecheck` 通过（API 和 Web）
- [ ] `pnpm test:run` 通过
- [ ] `pnpm lint` 通过
- [ ] `pnpm build` 通过
- [ ] E2E 测试通过（如涉及 UI 变更）

## 类型安全注意事项

<!-- 如果修改了涉及 axios 请求、Deribit API 响应或 shared-types 的代码，请额外确认 -->
- [ ] axios 错误处理使用了正确的 `AxiosError` 类型（而非 `Record<string, unknown>`）
- [ ] shared-types 的变更已重新构建（`pnpm --filter @kok/shared-types build`）

## 测试计划

<!-- 描述如何验证这些变更 -->
