/**
 * Tests for loadCanonicalProviders
 */
import { TestSuite, assertEqual, assertTruthy } from "./testUtils.js";
import {
  getCanonicalProviderMap,
  getCanonicalProviderByNames,
  _resetCache,
  _injectForTest,
} from "../helpers/loadCanonicalProviders.js";

const suite = new TestSuite("Load canonical providers");

suite.test("getCanonicalProviderMap and getCanonicalProviderByNames return injected new format", () => {
  _resetCache();
  const byTechnicalName = { max: { id: "max", name: "HBO Max" } };
  const byClearName = {
    "HBO Max": { id: "max", name: "HBO Max" },
    "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
  };
  _injectForTest({ byTechnicalName, byClearName });
  assertEqual(getCanonicalProviderMap(), byTechnicalName);
  assertEqual(getCanonicalProviderByNames(), byClearName);
  assertEqual(getCanonicalProviderMap().max?.id, "max");
  assertEqual(getCanonicalProviderByNames()["HBO Max  Amazon Channel"]?.id, "max");
});

suite.test("getCanonicalProviderByNames returns empty when only byTechnicalName injected", () => {
  _resetCache();
  _injectForTest({ byTechnicalName: { netflix: { id: "netflix", name: "Netflix" } }, byClearName: {} });
  assertTruthy(Object.keys(getCanonicalProviderMap()).length === 1);
  assertEqual(Object.keys(getCanonicalProviderByNames()).length, 0);
});

suite.test("_resetCache clears cache so next inject takes effect", () => {
  _resetCache();
  _injectForTest({ byTechnicalName: { x: { id: "x", name: "X" } }, byClearName: {} });
  assertTruthy(getCanonicalProviderMap().x != null);
  assertEqual(getCanonicalProviderMap().x.id, "x");
  _resetCache();
  _injectForTest({ byTechnicalName: {}, byClearName: {} });
  assertEqual(getCanonicalProviderMap().x, undefined);
});

const results = await suite.run();
process.exit(results.failed > 0 ? 1 : 0);
