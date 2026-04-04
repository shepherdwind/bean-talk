# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bean Talk is a personal finance accounting system that integrates Telegram, Gmail, and OpenAI to provide a conversational interface for managing finances using Beancount (double-entry accounting). Users interact via Telegram bot commands; the system also auto-processes bank emails from Gmail on a cron schedule.

## Specification Hierarchy

- `AGENTS.md` — workflows, review process, execution constraints
- `.claude/rules.md` — coding rules (takes precedence for all code changes)
- `.claude/skills/` — workflow entry points (`dev`, `dev-master`, `dev-plan`)

## Commands

```bash
npm run dev           # Start dev server (ts-node src/index.ts)
npm run build         # Compile TypeScript
npm start             # Run compiled output (node dist/index.ts)
npm test              # Run all Jest tests
npm test -- --testPathPattern=gmail   # Run tests matching pattern
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
npm run lint          # ESLint
```

## Architecture

Hexagonal architecture with three layers:

- **Domain** (`src/domain/`) — Business logic, models (Transaction, Account, MerchantCategoryMapping), and services (AccountingService, BeancountService, NLPService, BillParserService, BeancountQueryService)
- **Application** (`src/application/`) — Coordination layer. AutomationService schedules Gmail bill processing via cron
- **Infrastructure** (`src/infrastructure/`) — External adapters (Telegram, Gmail, OpenAI, Beancount file I/O), event system, utilities

Entry point: `src/index.ts` → `src/app-initializer.ts` (three-phase init: container registration → Gmail OAuth setup → cron automation).

### Key Patterns

**DI Container** (`src/infrastructure/utils/container.ts`): Custom singleton container. Services register via `container.registerClass()` / `container.registerClassFactory()` and resolve via `container.getByClass()`. Constructor injection uses container as default parameter.

**Event System** (`src/infrastructure/events/`): `ApplicationEventEmitter` as central bus, `EventListenerService` subscribes to domain events.

**Telegram Commands** (`src/infrastructure/telegram/commands/`): Strategy pattern with `BaseCommandHandler` abstract class. Each command (`/add`, `/query`, etc.) is a separate handler.

**Email Parsers** (`src/infrastructure/email-parsers/`): Strategy pattern via `EmailParserFactory`. Currently supports DBS bank; extensible for additional banks.

**Beancount Storage**: File-based at `BEANCOUNT_FILE_PATH/YYYY/MM.bean`. Queries execute via shell subprocess (`bean-query`).

### Data Flow: Automated Bill Processing

Gmail (cron) → EmailParser (strategy) → BillParserService → AccountingService → Beancount file → Telegram notification
