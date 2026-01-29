# Tests

Automated tests for the Letterboxd JustWatch integration.

## Running Tests

### All Unit Tests
```bash
npm test
```

### Individual Test Suites
```bash
npm run test:filter     # Filter logic tests
npm run test:state      # State management tests
```

### Browser Test
```bash
npm run dev
# Then open http://localhost:5173/testBrowserState.html
```

## Test Structure

### Unit Tests
- **filterLogic.test.js** - Tests the movie filtering algorithm
  - Verifies movies are correctly shown/hidden based on streaming provider filters
  - Tests single and multiple provider selection
  - No dependencies on DOM or external APIs

- **stateTileManagement.test.js** - Tests state/tile ID management
  - Verifies tile ID generation from title and year
  - Tests creating, updating, and moving tiles when year changes
  - Validates data preservation during updates

### Browser Test
- **testBrowserState.html** - End-to-end test in the browser
  - Simulates the full flow: create tiles → add providers → filter
  - Tests actual DOM manipulation and filterTiles() function
  - Visual pass/fail indicator

## Test Output

Tests automatically show:
- ✓ Passed tests in green
- ✗ Failed tests with error messages
- Total count of passed/failed tests

Example:
```
  Filter Logic
    ✓ Should hide movies with no providers when filter is active
    ✓ Should show movies with matching provider
    ✓ Should show correct count when filtering by Disney Plus
```

## Adding New Tests

1. Create a new file: `tests/yourTest.test.js`
2. Import test utilities:
```javascript
import { TestSuite, assertEqual, assert } from './testUtils.js';
```

3. Create test suite and add tests:
```javascript
const suite = new TestSuite('Your Feature');

suite.test('Should do something', () => {
  assertEqual(actual, expected);
});

await suite.run();
```

4. Add to package.json scripts:
```json
"test:yourfeature": "node tests/yourTest.test.js"
```

## Test Utilities

Available assertions from `testUtils.js`:
- `assert(condition, message)` - Basic assertion
- `assertEqual(actual, expected, message)` - Strict equality
- `assertDeepEqual(actual, expected, message)` - Deep object comparison
- `assertArrayLength(array, length, message)` - Array length check
- `assertTruthy(value, message)` - Truthy check
- `assertFalsy(value, message)` - Falsy check
