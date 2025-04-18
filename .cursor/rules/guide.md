# Code Refactoring Guidelines

## Core Principles

1. **Progressive Implementation** - Break down large tasks into smaller modules
2. **Feature-Driven Development** - Build for functionality, not just to pass tests
3. **Test-Driven Validation** - Ensure each module has test coverage
4. **Maintain Behavior Parity** - New implementations must match original behavior
5. **No Hacks or Shortcuts** - Avoid code that specifically targets test cases
6. **Clean Implementation** - Don't mock or bypass real logic
7. **English Comments Only** - Use English for all documentation and comments
8. **Structured Task Management** - Track progress with Markdown todo lists
9. **Appropriate Function Design** - Functions should be 3-150 lines, with proper abstraction
10. **String Constant Management** - Centralize string constants in dedicated files

## Implementation Guidelines

### Code Structure

- **Functions**: 3-150 lines per function
- **Files**: Maximum 500 lines per implementation file, 800 for test files
- **Constants**: Use enums to group related string constants
- **Conditions**: Use early returns and semantic variables to simplify logic

### Development Strategy

1. **Analysis**: Understand the existing code structure and functionality
2. **Design**: Create architecture with clear module boundaries
3. **Implementation**: Build incrementally, verify with tests at each step
4. **Integration**: Combine modules and verify full functionality

### Testing Requirements

- Each feature must have corresponding test cases
- New implementation must produce identical output to the original
- Tests must cover edge cases and exceptions
- Include performance tests to ensure comparable efficiency

### Prohibited Practices

- Hard-coding test case results
- Creating special conditions just to pass tests
- Mocking core functionality instead of implementing it
- Modifying tests to fit implementation (instead of vice versa)

## Examples of Good Practice

```javascript
// Good: Using constants and early returns
import { TokenTypes, Delimiters } from "./constants";

function processToken(token) {
  if (!token) return null;

  const isVariableToken = token.startsWith(Delimiters.VARIABLE_START) && token.endsWith(Delimiters.VARIABLE_END);

  if (isVariableToken) return createVariableNode(token);

  const tokenProcessors = {
    [TokenTypes.TEXT]: processTextToken,
    [TokenTypes.DIRECTIVE]: processDirectiveToken,
    [TokenTypes.COMMENT]: () => null,
  };

  const processor = tokenProcessors[token.type] || processUnknownToken;
  return processor(token);
}
```

## Examples of Bad Practice

```javascript
// Bad: Deeply nested conditions with string literals
function processToken(token) {
  if (token) {
    if (token.startsWith("${")) {
      if (token.endsWith("}")) {
        // More nesting...
      }
    }
  }
  return null;
}

// Bad: Implementation specifically targeting tests
function parseTemplate(template) {
  // Special case just for test
  if (template === "Hello, {{ name }}") {
    return [
      { type: "text", value: "Hello, " },
      { type: "variable", value: "name" },
    ];
  }
  // Actual implementation...
}
```