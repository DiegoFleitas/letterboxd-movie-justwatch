// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ToastProvider } from "../ToastProvider";
import { getToastImpl, setToastImpl } from "../toastApi";

describe("ToastProvider", () => {
  beforeEach(() => {
    setToastImpl(null);
  });

  it("registers toast implementation on mount and clears on unmount", async () => {
    const { unmount } = render(
      <ToastProvider>
        <span>child</span>
      </ToastProvider>,
    );
    await waitFor(() => {
      expect(getToastImpl()?.success).toBeTypeOf("function");
    });
    getToastImpl()?.success?.("toast ok");
    unmount();
    await waitFor(() => {
      expect(getToastImpl()).toBeNull();
    });
  });
});
