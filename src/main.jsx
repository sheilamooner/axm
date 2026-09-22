import "./polyfills";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import SolanaWalletRoot from "./components/providers/SolanaWalletRoot";
import { initLogRocket } from "./config/logrocket";

initLogRocket();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <SolanaWalletRoot>
      <App />
    </SolanaWalletRoot>
  </StrictMode>,
);
