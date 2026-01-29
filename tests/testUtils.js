/**
 * Simple test utilities for assertion and test organization
 */

export class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(description, fn) {
    this.tests.push({ description, fn });
  }

  async run() {
    console.log(`\n  ${this.name}`);
    
    for (const { description, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        console.log(`    ✓ ${description}`);
      } catch (error) {
        this.failed++;
        console.log(`    ✗ ${description}`);
        console.log(`      Error: ${error.message}`);
      }
    }
    
    return { passed: this.passed, failed: this.failed };
  }
}

export function assert(condition, message = 'Assertion failed') {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

export function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      message || `Expected ${expectedStr}, got ${actualStr}`
    );
  }
}

export function assertArrayLength(array, length, message) {
  if (!Array.isArray(array)) {
    throw new Error(message || `Expected an array, got ${typeof array}`);
  }
  if (array.length !== length) {
    throw new Error(
      message || `Expected array length ${length}, got ${array.length}`
    );
  }
}

export function assertTruthy(value, message) {
  if (!value) {
    throw new Error(message || `Expected truthy value, got ${value}`);
  }
}

export function assertFalsy(value, message) {
  if (value) {
    throw new Error(message || `Expected falsy value, got ${value}`);
  }
}
