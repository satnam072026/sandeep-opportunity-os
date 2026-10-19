import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/design-system.css";
import "./styles/hardening.css";
import "./styles/enterprise-overrides.css";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
