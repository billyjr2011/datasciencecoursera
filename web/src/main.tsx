import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { GBL } from "./theme";

// Inject global styles once at the root.
const style = document.createElement("style");
style.textContent = GBL;
document.head.appendChild(style);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
