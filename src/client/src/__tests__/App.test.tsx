// @vitest-environment jsdom
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../App";

vi.mock("@sentry/react", () => ({
  ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("App", () => {
  it("renders left and right panels", () => {
    render(<App />);
    expect(screen.getByTestId("left-panel")).toBeTruthy();
    expect(screen.getByTestId("right-panel")).toBeTruthy();
  });
});
