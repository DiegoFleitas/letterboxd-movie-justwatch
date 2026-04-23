import React, { Suspense, type LazyExoticComponent, type ReactElement } from "react";
import { isDevDebugBarEnabled } from "./devDebugBarEnv";

let LazyDevDebugBar: LazyExoticComponent<() => ReactElement | null> | null = null;

if (import.meta.env.DEV) {
  LazyDevDebugBar = React.lazy(async () => {
    const m = await import("./DevDebugBar");
    return { default: m.DevDebugBar };
  });
}

/** Loads `DevDebugBar` only in Vite dev so the module is not in the production bundle. */
export function DevDebugBarGate(): ReactElement | null {
  if (!import.meta.env.DEV || !isDevDebugBarEnabled() || !LazyDevDebugBar) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <LazyDevDebugBar />
    </Suspense>
  );
}
