import { ToastProvider } from "./ToastProvider.jsx";
import { AppStateProvider } from "./AppStateContext.jsx";
import { LeftPanel } from "./LeftPanel.jsx";
import { RightPanel } from "./RightPanel.jsx";

export function App() {
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
