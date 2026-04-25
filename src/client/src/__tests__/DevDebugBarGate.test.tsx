// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { AppStateProvider } from "../AppStateContext";
import { DevDebugBarGate } from "../DevDebugBarGate";
import { isDevDebugBarEnabled } from "../devDebugBarEnv";
import { devDebugBarGateDefaultPayload } from "./devDebugBarTestFixtures";
import { withMountedInBody } from "./reactRootTestUtils";

vi.mock("../devDebugBarEnv", () => ({
  isDevDebugBarEnabled: vi.fn(),
}));

const gateTree = (
  <AppStateProvider>
    <DevDebugBarGate />
  </AppStateProvider>
);

describe("DevDebugBarGate", () => {
  beforeEach(() => {
    sessionStorage.clear();
    document.body.classList.remove("has-dev-debug-bar");
    vi.mocked(isDevDebugBarEnabled).mockReset();
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => devDebugBarGateDefaultPayload,
    } as Response);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders nothing when the debug bar flag is disabled", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(false);

    await withMountedInBody(gateTree, async ({ container }) => {
      expect(container.querySelector('[data-testid="dev-debug-bar"]')).toBeNull();
    });
  });

  it("lazy-loads DevDebugBar when the flag is enabled", async () => {
    vi.mocked(isDevDebugBarEnabled).mockReturnValue(true);

    await withMountedInBody(gateTree, async ({ container }) => {
      await waitFor(() => {
        expect(container.querySelector('[data-testid="dev-debug-bar"]')).not.toBeNull();
      });
    });
  });
});
