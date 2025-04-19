# GitHub Copilot Guidelines

## Core Principles

1. **Modular Development** - Break down complex problems into manageable modules
2. **User-Centric Development** - Focus on building solutions that address actual needs
3. **Test Coverage Priority** - Ensure comprehensive test coverage for all code
4. **Functionality Consistency** - Maintain consistent behavior across implementations
5. **No Quick Fixes** - Avoid temporary solutions that accumulate technical debt
6. **Complete Implementation** - Fully implement features without placeholder code
7. **Documentation Standards** - Use clear English for all documentation and comments
8. **Task Organization** - Use structured todo lists and issue tracking
9. **Function Size Management** - Functions should be concise (3-150 lines) but complete
10. **Resource Centralization** - Manage constants and configuration in dedicated locations

## Implementation Guidelines

### Code Structure

- **Functions**: 3-150 lines per function
- **Files**: Maximum 500 lines per implementation file, 800 for test files
- **Constants**: Use enums or constant objects to group related values
- **Logic Flow**: Prefer early returns and meaningful variable names for readability

### Development Strategy

1. **Requirements Analysis**: Thoroughly understand the problem domain
2. **Architecture Planning**: Design modular architecture with clear boundaries
3. **Iterative Implementation**: Build features incrementally with continuous testing
4. **System Integration**: Verify cross-module functionality and end-to-end behavior

### Testing Requirements

- Each feature must have corresponding test suite
- Tests must validate core functionality and edge cases
- Implementation must align with existing behavior patterns
- Include performance considerations in critical paths

### Prohibited Practices

- Writing code that only satisfies test cases without solving the actual problem
- Implementing temporary workarounds without tracking technical debt
- Copying solutions without understanding underlying principles
- Over-engineering simple problems with excessive abstraction

## Examples of Good Practice

```typescript
// Good: Using constants and early returns
import { EmailTypes, DateFormats } from "./constants";

function parseEmailContent(content: string): ParsedEmail | null {
  if (!content) return null;

  const isTransactional = content.includes(EmailTypes.TRANSACTION_MARKER);
  
  if (isTransactional) {
    return extractTransactionDetails(content);
  }

  const emailProcessors = {
    [EmailTypes.BILL]: processBillEmail,
    [EmailTypes.STATEMENT]: processStatementEmail,
    [EmailTypes.NOTIFICATION]: processNotificationEmail,
  };

  const emailType = determineEmailType(content);
  const processor = emailProcessors[emailType] || processGenericEmail;
  return processor(content);
}
```

## Examples of Bad Practice

```typescript
// Bad: Hardcoded values and deep nesting
function parseEmailContent(content: string): ParsedEmail | null {
  if (content) {
    if (content.includes("TRANSACTION")) {
      if (content.includes("DEBIT")) {
        // Deep nesting continues...
      }
    }
  }
  return null;
}

// Bad: Incomplete implementation with TODOs
function processTransaction(transaction: Transaction): void {
  // TODO: Implement this later
  console.log("Processing transaction...");
  
  // No actual implementation, just returning mock data
  return {
    status: "success",
    id: "mock-id-123"
  };
}
```