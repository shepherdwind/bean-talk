# Task 007: Domain & Application Layer Test Coverage

## Goal

Add comprehensive unit tests for domain models, domain services, and the application layer to achieve 90%+ coverage in these modules.

## Current Coverage

| Module | Stmts | Target |
|--------|-------|--------|
| domain/models/merchant-category-mapping.ts | 35.6% | 90%+ |
| domain/services/accounting.service.ts | 43.8% | 90%+ |
| domain/services/nlp.service.ts | 39.0% | 90%+ |
| application/services/automation.service.ts | 87.2% | 90%+ |

## Files to Create/Modify

### New Test Files

- `src/domain/models/__tests__/merchant-category-mapping.test.ts`
- `src/domain/services/__tests__/accounting.service.test.ts`
- `src/domain/services/__tests__/nlp.service.test.ts`
- `src/application/services/__tests__/automation.service.test.ts`

### Source Files (read-only reference)

- `src/domain/models/merchant-category-mapping.ts`
- `src/domain/services/accounting.service.ts`
- `src/domain/services/nlp.service.ts`
- `src/application/services/automation.service.ts`

## Test Plan

### merchant-category-mapping.ts

Mock: `fs` module (readFileSync, writeFileSync, statSync), `path` module

- `updateMerchantCategoryMappingsIfNeeded()`: load from file, hot-reload on mtime change, skip reload when unchanged
- `findCategoryForMerchant()`: exact match, partial match, no match
- `addMerchantToMapping()`: add new merchant, update existing, persistence to file

### accounting.service.ts

Mock: `BeancountService`, `container`, merchant-category-mapping module

- `addTransaction()`: delegates to BeancountService
- `getAccountType()`: maps AccountName prefixes to AccountType (Assets, Expenses, Liabilities, Income, Equity)
- `getAccountByName()`: returns Account object with correct structure
- `getAccountsByType()`: filters correctly by type
- `getAllAccountNames()`: returns all enum values
- `findCategoryForMerchant()`: delegates to merchant-category-mapping
- `addMerchantToCategory()`: delegates to merchant-category-mapping
- `getAllMerchantCategoryMappings()`: returns copy of mappings

### nlp.service.ts

Mock: `OpenAIAdapter`, `AccountingService`, `container`

- `categorizeMerchant()`: parses 3-line response, handles error
- `autoCategorizeMerchant()`: parses JSON response, handles malformed JSON, handles error (returns safe default)
- `parseExpenseInput()`: parses JSON response, handles error
- `parseDateRange()`: parses JSON with dates, handles null/empty response, handles missing fields, handles error

### automation.service.ts

Mock: `GmailAdapter`, `TelegramAdapter`, `BillParserService`, `AccountingService`, `container`

- `scheduledCheck()`: no emails found, processes multiple emails, handles partial failures
- `processBillEmail()`: successful parse + save + notify, parse failure, save failure

## Acceptance Criteria

- All new tests pass with `npm test`
- Combined coverage for these 4 modules reaches 90%+ statements
- No external service calls — all mocked
- Tests cover both success and error paths

## Dependencies

None (independent task)
