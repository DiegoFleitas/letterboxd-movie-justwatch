/**
 * Simple test utilities for assertion and test organization
 */

interface TestCase {
  description: string;
  fn: () => void | Promise<void>;
}

export class TestSuite {
  name: string;
  tests: TestCase[];
  passed: number;
  failed: number;

  constructor(name: string) {
    this.name = name;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(description: string, fn: () => void | Promise<void>): void {
    this.tests.push({ description, fn });
  }

  async run(): Promise<{ passed: number; failed: number }> {
    console.log(`\n  ${this.name}`);

    for (const { description, fn } of this.tests) {
      try {
        await fn();
        this.passed++;
        console.log(`    ✓ ${description}`);
      } catch (error) {
        this.failed++;
        console.log(`    ✗ ${description}`);
        console.log(`      Error: ${(error as Error).message}`);
      }
    }

    return { passed: this.passed, failed: this.failed };
  }
}

export function assert(condition: boolean, message: string = "Assertion failed"): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function assertEqual<T>(actual: T, expected: T, message?: string): void {
  if (actual !== expected) {
    throw new Error(
      message || `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`
    );
  }
}

export function assertDeepEqual(actual: unknown, expected: unknown, message?: string): void {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(message || `Expected ${expectedStr}, got ${actualStr}`);
  }
}

export function assertArrayLength(array: unknown, length: number, message?: string): void {
  if (!Array.isArray(array)) {
    throw new Error(message || `Expected an array, got ${typeof array}`);
  }
  if (array.length !== length) {
    throw new Error(message || `Expected array length ${length}, got ${array.length}`);
  }
}

export function assertTruthy(value: unknown, message?: string): void {
  if (!value) {
    throw new Error(message || `Expected truthy value, got ${value}`);
  }
}

export function assertFalsy(value: unknown, message?: string): void {
  if (value) {
    throw new Error(message || `Expected falsy value, got ${value}`);
  }
}
