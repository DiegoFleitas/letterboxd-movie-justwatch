import type { ReactElement } from "react";
import { ErrorBoundary } from "@sentry/react";
import { ToastProvider } from "./ToastProvider";
import { AppStateProvider } from "./AppStateContext";
import { DevDebugBar } from "./DevDebugBar";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";

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
          <DevDebugBar />
        </ToastProvider>
      </AppStateProvider>
    </ErrorBoundary>
  );
}
