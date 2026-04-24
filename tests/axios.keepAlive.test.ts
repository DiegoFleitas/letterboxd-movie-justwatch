import { describe, it, expect } from "vitest";
import axiosHelper from "@server/lib/axios.js";

describe("axios helper factory", () => {
  it("returns axios instance without keepAlive by default", () => {
    const client = axiosHelper();
    expect(client.defaults.baseURL).toBeUndefined();
    expect(typeof client.get).toBe("function");
  });

  it("returns axios instance when keepAlive is true", () => {
    const client = axiosHelper(true);
    expect(typeof client.get).toBe("function");
  });
});
