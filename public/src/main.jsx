import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
