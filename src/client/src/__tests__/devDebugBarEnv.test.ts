import { describe, it, expect } from "vitest";
import { isDevDebugBarEnabled } from "../devDebugBarEnv";

describe("isDevDebugBarEnabled", () => {
  it("is false outside Vite dev", () => {
    if (!import.meta.env.DEV) {
      expect(isDevDebugBarEnabled()).toBe(false);
    }
  });

  it("in dev, is false only when VITE_DEV_DEBUG_BAR is the string false", () => {
    if (import.meta.env.DEV) {
      expect(isDevDebugBarEnabled()).toBe(import.meta.env.VITE_DEV_DEBUG_BAR !== "false");
    }
  });
});
