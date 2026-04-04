# Task 000: Fix broken tests and establish test baseline

## Goal

修复现有断裂测试，补充 domain/infrastructure 层核心测试，使 `npm test` 全部通过。为后续 TDD 迁移建立可靠基线。

## Current State

3/4 test suites failing:
- `dbs-email-parser.test.ts` — 日期断言硬编码年份，跨年后失败
- `categorization-command-handler.test.ts` — 构造函数签名与测试不匹配
- `beancount-query.service.test.ts` — 构造函数参数不匹配

1/4 passing:
- `beancount.service.test.ts`

## Work Items

### 1. Fix existing broken tests

- `dbs-email-parser.test.ts` — 用相对日期或 mock Date 替换硬编码年份
- `beancount-query.service.test.ts` — 更新构造函数调用匹配当前签名
- `categorization-command-handler.test.ts` — 最小化修复（Task 5 会删除此文件）

### 2. Add domain service tests

补充不依赖 Telegram 框架的测试：

- `AccountingService` — `addTransaction()` 写入 beancount 文件
- `BillParserService` — 邮件内容 → Transaction 转换
- `NLPService` — prompt 构造（mock OpenAI adapter）

### 3. Add email parser tests

- `EmailParserFactory` — parser 选择策略
- `DBSEmailParser` — 补充更多邮件格式覆盖

## Acceptance criteria

- `npm test` 全部通过（0 failures）
- Domain service 核心路径有 happy path 测试
- 测试不依赖外部服务（mock adapter 隔离）

## Dependencies

None
