# Chat Application Tests

This directory contains tests for the chat application. The tests are designed to test the real code without mocking, following the principles of testing real behavior rather than implementation details.

## Test Files

- **core-functionality.test.ts**: Tests the core functionality of the application, including message formatting and name generation.
- **models.test.ts**: Tests the data models (Message and User) to ensure they work as expected.
- **ui-components.test.ts**: Tests the UI components in a jsdom environment to ensure they render correctly.

## Testing Approach

Our testing approach follows these principles:

1. **Test Real Behavior**: We test the actual behavior of the code rather than implementation details.
2. **No Mocking**: We avoid mocking dependencies whenever possible, preferring to test the real code.
3. **Isolation**: Each test is isolated and doesn't depend on the state of other tests.
4. **Readability**: Tests are written to be readable and maintainable.

## Running Tests

To run all tests:

```bash
npm test
```

To run a specific test file:

```bash
npm test -- tests/core-functionality.test.ts
```

## Test Environment

- **Node Environment**: Used for testing server-side code and models.
- **jsdom Environment**: Used for testing UI components that interact with the DOM.

## Test Structure

Each test file follows a similar structure:

1. **Setup**: Set up any necessary state for the tests.
2. **Test Cases**: Individual test cases that verify specific behaviors.
3. **Cleanup**: Clean up any resources used by the tests.

## Adding New Tests

When adding new tests, follow these guidelines:

1. Create a new test file if testing a new component or feature.
2. Follow the existing test structure.
3. Test real behavior, not implementation details.
4. Avoid mocking dependencies unless absolutely necessary.
5. Keep tests isolated and independent.
6. Write clear, descriptive test names.
7. Use the appropriate test environment (node or jsdom).
