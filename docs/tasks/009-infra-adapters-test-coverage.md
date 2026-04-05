# Task 009: Infrastructure Adapters Test Coverage

## Goal

Add comprehensive unit tests for Gmail, OpenAI, and Telegram infrastructure adapters to achieve 90%+ coverage.

## Current Coverage

| Module | Stmts | Target |
|--------|-------|--------|
| infrastructure/gmail/token-manager.ts | 6.8% | 90%+ |
| infrastructure/gmail/email-processor.ts | 14.3% | 90%+ |
| infrastructure/gmail/email.utils.ts | 16.1% | 90%+ |
| infrastructure/gmail/gmail.adapter.ts | 22.7% | 90%+ |
| infrastructure/openai/openai.adapter.ts | 30.0% | 90%+ |
| infrastructure/telegram/telegram.adapter.ts | 14.0% | 90%+ |
| infrastructure/telegram/bot.ts | 65.0% | 90%+ |
| infrastructure/telegram/commands/query-command-handler.ts | 18.8% | 90%+ |
| infrastructure/telegram/commands/custom-query-command-handler.ts | 17.6% | 90%+ |
| infrastructure/telegram/commands/categorization-constants.ts | 50.0% | 90%+ |
| infrastructure/telegram/grammy-types.ts | 50.0% | 90%+ |
| infrastructure/telegram/conversations/add-bill.ts | 12.7% | 90%+ |
| infrastructure/telegram/conversations/categorization.ts | 13.0% | 90%+ |

## Files to Create/Modify

### New Test Files

- `src/infrastructure/gmail/__tests__/token-manager.test.ts`
- `src/infrastructure/gmail/__tests__/email-processor.test.ts`
- `src/infrastructure/gmail/__tests__/email.utils.test.ts`
- `src/infrastructure/gmail/__tests__/gmail.adapter.test.ts`
- `src/infrastructure/openai/__tests__/openai.adapter.test.ts`
- `src/infrastructure/telegram/__tests__/telegram.adapter.test.ts`
- `src/infrastructure/telegram/commands/__tests__/query-command-handler.test.ts`
- `src/infrastructure/telegram/commands/__tests__/custom-query-command-handler.test.ts`
- `src/infrastructure/telegram/commands/__tests__/categorization-constants.test.ts`

### Existing Test Files (extend)

- `src/infrastructure/telegram/__tests__/bot.test.ts`
- `src/infrastructure/telegram/conversations/__tests__/add-bill.test.ts`
- `src/infrastructure/telegram/conversations/__tests__/categorization.test.ts`

## Test Plan

### token-manager.ts

Mock: `googleapis` (OAuth2Client), `fs/promises`, `http.createServer`, `container`

- `loadCredentials()`: reads and parses credentials.json, handles missing file
- `loadTokens()`: reads tokens, returns null if not found
- `initialize()`: full OAuth flow with existing tokens, with new tokens needed
- `checkAndRefreshToken()`: refreshes when within 10 min of expiry, skips when valid
- `scheduleTokenRefresh()`: schedules timer, clears previous timer
- `saveTokens()`: persists to file

### email-processor.ts

Mock: `google.gmail()` API

- `fetchUnreadEmails()`: returns parsed emails, handles empty results, handles API errors
- `markAsRead()`: calls modify API, handles errors
- `getEmailDetails()`: extracts headers and body from payload

### email.utils.ts

Mock: `html-to-text`

- `extractEmailHeaders()`: extracts subject, from, date, to from header array
- `extractEmailBody()`: decodes base64 body, handles multipart, handles plain text vs HTML
- `htmlToPlainText()`: delegates to html-to-text
- `processEmailContent()`: detects HTML vs plain text

### gmail.adapter.ts

Mock: `TokenManager`, `EmailProcessor`, `google.gmail()`

- `initialize()`: initializes token manager, verifies connection
- `fetchUnreadEmails()`: delegates to processor
- `markAsRead()`: delegates to processor

### openai.adapter.ts

Mock: `openai` SDK

- Constructor: accepts options, sets defaults for model and baseURL
- `processMessage()`: calls chat completions, returns content, handles errors

### telegram.adapter.ts

Mock: `grammy` Bot, `container`

- `sendNotification()`: sends message, sends with inline keyboard, retry on failure
- `getPendingMerchant()` / `removePendingMerchant()`: pending merchant registry
- `removePendingMerchantByMerchantId()`: removes by merchant ID

### query-command-handler.ts

Mock: `BeancountQueryService`, `container`, `formatQueryResult`

- `handle()`: shows inline keyboard with time range options
- `handleTimeRange()`: routes to correct handler
- Time range handlers: correct date calculations for today, yesterday, this/last week, this/last month
- `processQuery()`: executes query and formats result

### custom-query-command-handler.ts

Mock: `NLPService`, `BeancountQueryService`, `container`, `formatQueryResult`

- `handle()`: filters for '查' prefix, parses date range, executes query
- Handles NLP parse failure with user-friendly error message

### categorization-constants.ts

- `CALLBACK_PREFIXES`: verify all prefix values are non-empty strings
- `MESSAGES`: verify all message templates exist and are callable/valid
- `CATEGORY_TYPES`: verify all category type values

### grammy-types.ts

- Import and verify type exports are accessible (coverage via import)

### conversations (extend existing)

- add-bill.ts: cover error paths, cancellation flow, invalid input handling
- categorization.ts: cover error paths, cancellation flow, category selection

### bot.ts (extend existing)

- Cover uncovered lines for bot setup and error handling

## Acceptance Criteria

- All new tests pass with `npm test`
- Combined coverage for these modules reaches 90%+ statements
- All external APIs (Gmail, OpenAI, Telegram) are fully mocked
- Tests cover success paths, error paths, and edge cases

## Dependencies

None (independent task)
