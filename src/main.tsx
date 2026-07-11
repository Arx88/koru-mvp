import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./ui/App";
import { DevCardPreview } from "./ui/DevCardPreview";
import "./style.css";

const isPreview = new URLSearchParams(location.search).get("preview") === "cards";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isPreview ? <DevCardPreview /> : <App />}
  </React.StrictMode>,
);
