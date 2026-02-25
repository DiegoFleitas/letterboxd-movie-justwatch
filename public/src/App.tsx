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
          <div className="left-panel" data-testid="left-panel">
            <LeftPanel />
          </div>
          <div className="right-panel" data-testid="right-panel">
            <RightPanel />
          </div>
        </div>
      </ToastProvider>
    </AppStateProvider>
  );
}
