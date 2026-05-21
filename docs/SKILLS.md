# SKILLS.md

Superpowers 技能体系开发规范。所有开发任务开始前需先查阅本文档及 `docs/superpowers/` 下的 spec 和 plan。

## Spec / Plan 参考规则

任何开发任务开始前，必须先查阅 `docs/superpowers/specs/` 和 `docs/superpowers/plans/` 下的相关文档。这包括但不限于：

- **开发**：依据 spec 的需求定义和 plan 的实施步骤编写代码
- **测试**：对照 spec 中的验收标准设计测试用例
- **代码审查（PR review）**：逐条核对 spec 和 plan，确认功能已开发全面且无遗漏
- **调试**：参考 plan 中的架构决策和约束条件定位问题

若不存在对应的 spec 或 plan，则按任务性质触发下方的 skill 流程来产出。

## 开发流程（渐进式 Skill 加载）

以下不是必须严格执行的流水线，而是根据任务性质 **按需触发** 的技能集合。系统会在合适时机自动加载对应 skill，不需要手动记忆。

### 环境隔离
- **触发**：任何可能修改现有代码的工作
- **自动加载**：`superpowers:using-git-worktrees` → 创建独立 worktree，避免污染当前工作区

#### 跨 worktree 移动变更的正确方式

Worktree 只隔离 git 追踪的状态，不隔离文件系统。通过 Finder 或 `cp` 从 worktree 复制文件到主仓库会导致 macOS 自动生成 `filename 2.ext` 副本，污染 git 状态。

**✅ 正确做法**：

| 场景 | 命令 |
|------|------|
| worktree 已有提交 | `git cherry-pick <commit>` |
| worktree 有未提交的变更 | `git diff > changes.patch && git apply changes.patch` |
| 只需某个文件 | `git checkout <branch> -- <file>` |
| 合并整个分支 | `git merge <branch>` 或 `git rebase <branch>` |

**❌ 禁止做法**：
- 在 Finder 中拖拽文件跨 worktree
- 使用 `cp`、`rsync` 等文件系统工具复制
- 直接操作 `.git/` 目录内的文件

### 需求探索与设计
- **触发**：需求不清晰、涉及新功能、需要架构决策
- **自动加载**：`superpowers:brainstorming` → 产出设计文档到 `docs/superpowers/specs/YYYY-MM-DD-feature-name.md`

### 制定实施计划
- **触发**：需求已明确，涉及多步骤修改
- **自动加载**：`superpowers:writing-plans` → 产出实施计划到 `docs/superpowers/plans/YYYY-MM-DD-feature-name.md`

### 测试驱动开发
- **触发**：实施功能或修复 bug
- **自动加载**：`superpowers:test-driven-development` → 先写测试，再写实现（Red-Green-Refactor）

### 系统调试
- **触发**：测试失败、行为不符合预期
- **自动加载**：`superpowers:systematic-debugging`

### 并行开发
- **触发**：有 2+ 可并行的独立任务
- **自动加载**：`superpowers:dispatching-parallel-agents`

### 计划实施
- **触发**：计划已制定，需要按任务逐步执行
- **自动加载**：`superpowers:subagent-driven-development` 或 `superpowers:executing-plans`

### 完成验证
- **触发**：声称工作完成前
- **自动加载**：`superpowers:verification-before-completion`

### 代码审查
- **触发**：提交 PR 前或收到 review 反馈
- **自动加载**：`superpowers:requesting-code-review` / `superpowers:receiving-code-review`
- **对照检查**：review 时去 `docs/superpowers/` 下的 specs 和 plans 逐项核对功能是否开发全面

### 分支收尾
- **触发**：实现完成、测试全部通过
- **自动加载**：`superpowers:finishing-a-development-branch`

## Documentation Safety Rules

### Plan / Spec 文档必须立即提交

使用 superpowers 技能创建 `docs/superpowers/plans/` 或 `docs/superpowers/specs/` 文档后，**必须立即执行 `git add && git commit`**，然后才能继续下一步（如创建 worktree、切换分支）。

```bash
# 创建 plan 或 spec 后立即提交
git add docs/superpowers/
git commit -m "docs: add [feature] plan/spec"
```

**原因**：这些文档在 worktree 切换时极易丢失（worktree 切换不会自动携带未提交的更改），且 `.claude/` 和 `.superpowers/` 已在 `.gitignore` 中。

### Worktree 切换前检查

切换 worktree 前，运行以下脚本检查是否有未提交的 docs：

```bash
source scripts/pre-worktree-switch.sh
```

若检测到未提交的 `docs/superpowers/` 更改，脚本会阻止切换并提供处理选项（commit / stash / bypass）。

### Dangling Commit 恢复

若怀疑文档已丢失在 dangling commit 中：

```bash
# 扫描丢失的文档
./scripts/check-dangling-docs.sh

# 自动恢复到 docs/superpowers/recovered/
./scripts/check-dangling-docs.sh --recover
```
