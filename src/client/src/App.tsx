import type { ReactElement } from "react";
import { ErrorBoundary } from "@sentry/react";
import { ToastProvider } from "./components/ToastProvider";
import { AppStateProvider } from "./components/AppStateContext";
import { DevDebugBarGate } from "./components/DevDebugBarGate";
import { LeftPanel } from "./components/LeftPanel";
import { RightPanel } from "./components/RightPanel";

export function App(): ReactElement {
  return (
    <ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <AppStateProvider>
        <ToastProvider>
          <div className="wrapper">
            <aside className="left-panel" data-testid="left-panel" aria-label="Search controls">
              <LeftPanel />
            </aside>
            <main className="right-panel" data-testid="right-panel" aria-label="Search results">
              <RightPanel />
            </main>
          </div>
          <DevDebugBarGate />
        </ToastProvider>
      </AppStateProvider>
    </ErrorBoundary>
  );
}
