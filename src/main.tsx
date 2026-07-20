import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./styles.css";
import { Capacitor } from "@capacitor/core";

if (Capacitor.isNativePlatform()) {
  setTimeout(() => {
    const { StatusBar } = (Capacitor as any).Plugins;
    StatusBar.setOverlaysWebView({ overlay: true });
    StatusBar.setBackgroundColor({ color: '#00000000' });
  }, 500);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);