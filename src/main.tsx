import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import "./styles.css";

function mountApp(): void {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    document.body.innerHTML =
      '<pre style="padding:16px;color:#b42318">Nasaq UI root element not found.</pre>';
    return;
  }

  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountApp);
} else {
  mountApp();
}
