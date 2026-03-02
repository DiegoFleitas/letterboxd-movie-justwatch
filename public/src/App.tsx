import type { ReactElement } from "react";
import { ToastProvider } from "./ToastProvider";
import { AppStateProvider } from "./AppStateContext";
import { LeftPanel } from "./LeftPanel";
import { RightPanel } from "./RightPanel";

export function App(): ReactElement {
  return (
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
      </ToastProvider>
    </AppStateProvider>
  );
}
