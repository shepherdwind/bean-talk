# Task 008: Infrastructure Utilities & Events Test Coverage

## Goal

Add comprehensive unit tests for infrastructure utility modules, event system, and email parser modules to achieve 90%+ coverage.

## Current Coverage

| Module | Stmts | Target |
|--------|-------|--------|
| infrastructure/utils/query-result-formatter.ts | 6.1% | 90%+ |
| infrastructure/utils/date.utils.ts | 66.7% | 90%+ |
| infrastructure/utils/logger.ts | 66.0% | 90%+ |
| infrastructure/utils/telegram.ts | 61.1% | 90%+ |
| infrastructure/utils/container.ts | 82.6% | 90%+ |
| infrastructure/beancount/beancount-query.service.ts | 70.0% | 90%+ |
| infrastructure/events/message-queue.service.ts | 71.1% | 90%+ |
| infrastructure/events/event-listener.service.ts | 89.5% | 90%+ |
| infrastructure/email-parsers/dbs-transaction-extractor.ts | 70.1% | 90%+ |
| infrastructure/email-parsers/email-parser-factory.ts | 83.3% | 90%+ |

## Files to Create/Modify

### New Test Files

- `src/infrastructure/utils/__tests__/query-result-formatter.test.ts`
- `src/infrastructure/utils/__tests__/date.utils.test.ts`
- `src/infrastructure/utils/__tests__/logger.test.ts`
- `src/infrastructure/utils/__tests__/telegram.test.ts`
- `src/infrastructure/utils/__tests__/container.test.ts`
- `src/infrastructure/beancount/__tests__/beancount-query.service.test.ts` (extend existing)
- `src/infrastructure/events/__tests__/message-queue.service.test.ts`
- `src/infrastructure/email-parsers/__tests__/dbs-transaction-extractor.test.ts` (new or extend existing)
- `src/infrastructure/email-parsers/__tests__/email-parser-factory.test.ts`

### Existing Test Files (may need extension)

- `src/infrastructure/events/__tests__/event-listener.service.test.ts` (if exists, extend for missing lines)

## Test Plan

### query-result-formatter.ts

Mock: `ACCOUNT_TELEGRAM_MAP`

- `formatQueryResult()`: formats assets + expenses sections, handles empty results, handles multiple users, handles single user, column alignment

### date.utils.ts

- `formatDateToUTC8()`: valid date, undefined input, timezone correctness (UTC+8)
- `formatTimeToUTC8()`: valid date, undefined input
- `formatDateToYYYYMMDD()`: standard date formatting
- `formatDateToMMDD()`: standard date formatting

### logger.ts

Mock: `process.stdout.write`, `process.stderr.write`, `chalk`

- Constructor / singleton: `getInstance()` returns same instance, `createLogger()` creates new instance
- `setLogLevel()`: changes filtering behavior
- Log methods: debug/info write to stdout, warn/error write to stderr
- Level filtering: messages below threshold are suppressed
- Object pretty-printing: objects are JSON-stringified
- Timestamp format: SGT timezone

### telegram.ts (utils)

- `ACCOUNT_TELEGRAM_MAP`: verify map entries
- `getAccountByEmail()`: known email, unknown email fallback
- `TELEGRAM_LINK_REGEX`: regex matching behavior

### container.ts (extend existing)

- `registerClass()` / `getByClass()`: register and retrieve by class reference
- `registerClassFactory()`: lazy instantiation
- Error on missing registration
- Cover uncovered lines 60, 78-87

### beancount-query.service.ts (extend existing)

- Cover uncovered lines 80-99 (query execution error paths, result parsing edge cases)

### message-queue.service.ts

Mock: `EventEmitter`, `container`, `removePendingMerchantByMerchantId`

- `enqueue()`: adds to queue, starts processing, prevents duplicates by taskId
- `completeTask()`: removes task, processes next item
- `processQueue()`: sequential processing with lock
- `startTaskTimeout()`: auto-completes after timeout
- `clearTasksByMerchant()`: filters queue by merchant
- `getQueueLength()`, `isQueueProcessing()`: state accessors

### event-listener.service.ts (extend existing)

- Cover uncovered lines 91-93, 113 (error paths or edge cases)

### dbs-transaction-extractor.ts (extend existing)

- `extractAmount()`: S$ format, foreign currency format, missing amount
- `extractDate()`: standard format, missing date
- `extractMerchant()`: standard format, missing merchant
- `extractCardInfo()`: standard format, missing card
- `parseAmount()`: decimal handling, rounding
- `parseDate()`: month parsing, year inference

### email-parser-factory.ts

- `registerParser()`: adds parser to list
- `findParser()`: finds matching parser, returns null when none matches
- `parseEmail()`: delegates to found parser, returns null when no parser

## Acceptance Criteria

- All new tests pass with `npm test`
- Combined coverage for these modules reaches 90%+ statements
- Tests cover error paths and edge cases
- No external service calls

## Dependencies

None (independent task)
