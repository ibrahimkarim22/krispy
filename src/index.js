import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import StartupIntro from "./ui/StartupIntro";
import "./index.css";
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StartupIntro>
      <App />
    </StartupIntro>
  </React.StrictMode>,
);
