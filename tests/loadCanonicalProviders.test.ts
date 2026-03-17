import { describe, it, expect, beforeEach } from "vitest";
import {
  getCanonicalProviderMap,
  getCanonicalProviderByNames,
  _resetCache,
  _injectForTest,
} from "../helpers/loadCanonicalProviders.js";

describe("loadCanonicalProviders", () => {
  beforeEach(() => {
    _resetCache();
  });

  it("getCanonicalProviderMap and getCanonicalProviderByNames return injected new format", () => {
    const byTechnicalName = { max: { id: "max", name: "HBO Max" } };
    const byClearName = {
      "HBO Max": { id: "max", name: "HBO Max" },
      "HBO Max  Amazon Channel": { id: "max", name: "HBO Max" },
    };
    _injectForTest({ byTechnicalName, byClearName });
    expect(getCanonicalProviderMap()).toEqual(byTechnicalName);
    expect(getCanonicalProviderByNames()).toEqual(byClearName);
    expect(getCanonicalProviderMap().max?.id).toBe("max");
    expect(getCanonicalProviderByNames()["HBO Max  Amazon Channel"]?.id).toBe("max");
  });

  it("getCanonicalProviderByNames returns empty when only byTechnicalName injected", () => {
    _injectForTest({
      byTechnicalName: { netflix: { id: "netflix", name: "Netflix" } },
      byClearName: {},
    });
    expect(Object.keys(getCanonicalProviderMap()).length).toBe(1);
    expect(Object.keys(getCanonicalProviderByNames()).length).toBe(0);
  });

  it("_resetCache clears cache so next inject takes effect", () => {
    _injectForTest({ byTechnicalName: { x: { id: "x", name: "X" } }, byClearName: {} });
    expect(getCanonicalProviderMap().x).toBeDefined();
    expect(getCanonicalProviderMap().x!.id).toBe("x");
    _resetCache();
    _injectForTest({ byTechnicalName: {}, byClearName: {} });
    expect(getCanonicalProviderMap().x).toBeUndefined();
  });
});
