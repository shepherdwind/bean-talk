# Task 000: Establish test baseline and verification checklist

## Goal

在开始迁移之前，修复现有断裂的测试并补充关键路径的测试覆盖，确保迁移过程中有可靠的回归验证手段。

## Current State

3/4 test suites failing:
- `dbs-email-parser.test.ts` — 日期断言因年份硬编码失败
- `categorization-command-handler.test.ts` — 构造函数签名与测试不匹配
- `beancount-query.service.test.ts` — 构造函数参数不匹配

1/4 passing:
- `beancount.service.test.ts` — 正常

## Work Items

### 1. Fix existing broken tests

- `dbs-email-parser.test.ts` — 修复日期断言，使用相对日期或 mock Date
- `beancount-query.service.test.ts` — 更新构造函数调用，匹配当前签名
- `categorization-command-handler.test.ts` — 更新构造函数调用；注意此测试在 Task 5 中会被删除，最小化修复即可

### 2. Add missing tests for core domain services

优先补充不依赖 Telegram 框架的测试（这些在迁移过程中不应受影响）：

- `AccountingService` — 测试 `addTransaction()` 写入 beancount 文件
- `BillParserService` — 测试邮件内容 → Transaction 的转换
- `NLPService` — 测试 prompt 构造（mock OpenAI adapter）

### 3. Add email parser coverage

- `EmailParserFactory` — 测试 parser 选择策略
- `DBSEmailParser` — 补充更多邮件格式的测试用例

## Acceptance criteria

- `npm test` 全部通过（0 failures）
- 核心 domain service 有基本的 happy path 测试
- Email parser 有覆盖主要格式的测试
- 测试不依赖 Telegraf 或 grammY（纯 domain/infrastructure 层）

## Dependencies

None — this is the first task.
