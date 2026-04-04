# Task 007: Update tests

## Goal

Fix all broken tests and add coverage for the new grammY-based conversation flows.

## Files to modify/create

- `src/infrastructure/telegram/commands/__tests__/categorization-command-handler.test.ts` — **delete** (handler no longer exists)
- `src/infrastructure/telegram/conversations/__tests__/add-bill.test.ts` (new) — test add-bill conversation
- `src/infrastructure/telegram/conversations/__tests__/categorization.test.ts` (new) — test categorization conversation
- `src/infrastructure/telegram/commands/__tests__/query-command-handler.test.ts` (new or update) — test query handlers with grammY API
- Existing non-Telegram tests (`beancount.service.test.ts`, `dbs-email-parser.test.ts`, `beancount-query.service.test.ts`) — fix pre-existing failures unrelated to this migration

## Test scenarios for conversations

### add-bill conversation
- Happy path: enter text → parse → confirm → saved
- Cancel: enter text → parse → cancel → not saved
- Invalid input: enter non-parseable text → error message → retry or exit

### categorization conversation
- Happy path: click categorize → enter context → select category → event emitted
- Cancel: click categorize → cancel mid-flow
- Timeout: no user response (if timeout is implemented)

## Inputs

- Conversation functions from Tasks 003, 004
- grammY test utilities (mock context, mock conversation)

## Outputs

- All tests pass (`npm test`)
- Conversation flows have test coverage

## Acceptance criteria

- `npm test` passes with 0 failures
- No references to Telegraf API in test code
- Conversation happy path + cancel flows covered
- Pre-existing test failures in non-Telegram tests fixed

## Dependencies

- Task 002, Task 003, Task 004, Task 005, Task 006
