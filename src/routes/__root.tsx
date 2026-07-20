import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";
import { UndoToast } from "@/components/UndoToast";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-4">Page not found</p>
        <Link to="/" className="mt-6 inline-block underline">Go home</Link>
      </div>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    try {
      const raw = localStorage.getItem("balance:v4");
      if (!raw) return;
      const state = JSON.parse(raw);
      if (!state?.notificationsEnabled) return;
      if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
      const now = new Date();
      const wkKey = `balance:notif:wk:${now.getFullYear()}-${Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 86400000))}`;
      const moKey = `balance:notif:mo:${now.getFullYear()}-${now.getMonth()}`;
      if (now.getDay() === 0 && !localStorage.getItem(wkKey)) {
        new Notification("Your week in Balance", { body: "Tap to see this week's analytics." });
        localStorage.setItem(wkKey, "1");
      }
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      if (tomorrow.getDate() === 1 && !localStorage.getItem(moKey)) {
        new Notification("Your month in Balance", { body: "Tap to see this month's analytics." });
        localStorage.setItem(moKey, "1");
      }
    } catch {}
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <UndoToast />
    </QueryClientProvider>
  );
}