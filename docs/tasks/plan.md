# Development Plan: Migrate Telegram Bot from Telegraf to grammY + Conversations

## Goal

Replace Telegraf with grammY and @grammyjs/conversations to fix lifecycle/state management chaos.

## Tasks

| # | Task | Status | Depends On | File |
|---|------|--------|------------|------|
| 0 | Establish test baseline and verification checklist | pending | — | [000](000-test-baseline.md) |
| 1 | Set up grammY core with session middleware | pending | 0 | [001](001-setup-grammy-core.md) |
| 2 | Migrate query commands (stateless) | pending | 1 | [002](002-migrate-query-commands.md) |
| 3 | Rewrite add-bill flow as grammY conversation | pending | 1 | [003](003-rewrite-add-bill-conversation.md) |
| 4 | Rewrite categorization flow as grammY conversation | pending | 1 | [004](004-rewrite-categorization-conversation.md) |
| 5 | Migrate TelegramAdapter and remove Telegraf | pending | 2, 3, 4 | [005](005-migrate-telegram-adapter.md) |
| 6 | Wire event-driven categorization entry | pending | 4, 5 | [006](006-wire-event-driven-categorization.md) |
| 7 | Update tests | pending | 2, 3, 4, 5, 6 | [007](007-update-tests.md) |

## Dependency Graph

```
0 (test baseline)
└── 1 (grammY core + session)
    ├── 2 (query commands)
    ├── 3 (add-bill conversation)
    └── 4 (categorization conversation)
        All of 2, 3, 4 ──► 5 (remove Telegraf)
                            └── 6 (event-driven entry)
                                 └── 7 (tests)
```

## Testing Strategy

### Problem

现有测试 3/4 失败，测试与生产代码不同步，迁移过程缺乏回归验证手段。

### Approach

1. **Task 0（前置）**: 修复现有测试 + 补充核心流程的集成测试，建立可运行的测试基线
2. **每个 task 完成后**: 运行 `npm test` 确保不引入回归
3. **手动验证清单**: 每个 task PR 提交前，按清单在 dev 环境手动验证

### Manual Verification Checklist

迁移期间每个 task 完成后需验证：

- [ ] `/start` — bot 正常响应
- [ ] `/add` — 输入账单 → NLP 解析 → 确认/取消 → 写入 beancount 文件
- [ ] `/query` — 选择时间范围 → 返回查询结果
- [ ] `查` 前缀文本 — 触发自定义查询
- [ ] `/cancel` — 中断当前流程
- [ ] 邮件触发 → 通知到 Telegram → 点击分类按钮 → 输入上下文 → 选择分类 → 写入映射
- [ ] 多条分类通知排队 → 逐条处理
- [ ] 进程重启后 session 数据不丢失（Task 1 之后）
