# Task 000: Fix broken tests and establish test baseline

## Goal

修复现有断裂测试，为核心流程编写集成测试，使 `npm test` 全部通过。为后续 TDD 迁移建立可靠基线。

## Current State

3/4 test suites failing:
- `dbs-email-parser.test.ts` — 日期断言硬编码年份，跨年后失败
- `categorization-command-handler.test.ts` — 构造函数签名与测试不匹配
- `beancount-query.service.test.ts` — 构造函数参数不匹配

## Work Items

### 1. Fix existing broken tests

- `dbs-email-parser.test.ts` — 用相对日期或 mock Date 替换硬编码年份
- `beancount-query.service.test.ts` — 更新构造函数调用匹配当前签名
- `categorization-command-handler.test.ts` — 最小化修复（Task 5 会删除此文件）

### 2. Core integration test: email → bill → beancount (known merchant)

测试已知商户的完整流程，mock 外部边界：

```
Gmail fetch (mock) → EmailParser → BillParserService → AccountingService
→ BeancountService.appendTransaction() (写入 tmp 文件) → markAsRead (mock)
```

验证点：
- 邮件正确解析为 Transaction（金额、日期、商户、币种）
- Transaction 正确写入 beancount 文件（格式、路径）
- Gmail 标记已读被调用

Mock 边界：
- `GmailAdapter` — mock `fetchUnreadEmails()` 返回测试邮件，mock `markAsRead()`
- `TelegramAdapter` — mock `sendNotification()`
- 商户映射文件 — 使用 tmp 文件，预填已知商户
- Beancount 文件 — 使用 tmp 目录

### 3. Core integration test: email → unknown merchant → event → queue

测试未知商户触发分类事件的流程：

```
Gmail fetch (mock) → EmailParser → 未知商户 → 写入映射(空分类)
→ emit MERCHANT_NEEDS_CATEGORIZATION → MessageQueueService.enqueue()
→ queue 事件 → EventListenerService 构建通知 → TelegramAdapter.sendNotification()
```

验证点：
- 未知商户写入映射文件（分类为空字符串）
- `MERCHANT_NEEDS_CATEGORIZATION` 事件被发射
- 消息入队并通过队列处理
- Telegram 通知被发送（含商户名、金额）

Mock 边界：
- `GmailAdapter` — mock
- `TelegramAdapter` — mock `sendNotification()`，验证调用参数
- `OpenAIAdapter` — 不涉及（此阶段还没到 AI 分类）
- 文件 I/O — 使用 tmp 文件

### 4. Core integration test: categorization → AI → save mapping

测试从用户触发 AI 分类到保存映射的流程：

```
NLPService.categorizeMerchant() (mock OpenAI) → 返回分类建议
→ emit MERCHANT_CATEGORY_SELECTED → AccountingService.addMerchantToCategory()
→ 映射文件更新 → MessageQueueService.completeTask()
```

验证点：
- NLP prompt 包含商户名、用户上下文、账户列表
- OpenAI 返回被正确解析为 3 个分类建议
- 选择分类后映射文件正确更新
- 队列任务完成并推进

Mock 边界：
- `OpenAIAdapter` — mock `processMessage()` 返回固定格式
- 文件 I/O — 使用 tmp 文件

### 5. Queue behavior tests

- 多条通知顺序处理（第一条完成后才处理第二条）
- 相同商户去重（`clearTasksByMerchant`）
- 队列空后触发 `scheduledCheck()`

## Mock Boundary Summary

| 边界 | Mock 方式 |
|------|----------|
| Gmail API | mock `GmailAdapter` 的 `fetchUnreadEmails()` 和 `markAsRead()` |
| Telegram API | mock `TelegramAdapter` 的 `sendNotification()` |
| OpenAI API | mock `OpenAIAdapter` 的 `processMessage()` |
| 商户映射文件 | `MERCHANT_CATEGORY_CONFIG_PATH` 指向 tmp 文件 |
| Beancount 文件 | `BEANCOUNT_FILE_PATH` 指向 tmp 目录 |

## Acceptance criteria

- `npm test` 全部通过（0 failures）
- 已知商户 email → beancount 完整链路有集成测试
- 未知商户 email → 事件 → 队列 → 通知链路有集成测试
- AI 分类 → 保存映射链路有集成测试
- 队列行为有测试覆盖
- 所有测试不依赖外部服务

## Dependencies

None
