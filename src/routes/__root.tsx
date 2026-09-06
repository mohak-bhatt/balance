import { setupDeepLinkAuth } from "@/lib/deepLinkAuth";
import { setupNotificationTapListener } from "@/lib/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect } from "react";
import { UndoToast } from "@/components/UndoToast";
import { AuthProvider } from "@/lib/AuthContext";
import { OverlayProvider, useOverlayState } from "@/lib/OverlayContext";
import { FocusModeProvider } from "@/lib/FocusModeContext";

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
  const navigate = useNavigate();

  useEffect(() => {
    const listenerPromise = setupNotificationTapListener(navigate);
    return () => {
      listenerPromise.then((listener) => listener.remove());
    };
  }, [navigate]);

  useEffect(() => {
    setupDeepLinkAuth();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FocusModeProvider>
          <OverlayProvider>
            <RootContent />
          </OverlayProvider>
        </FocusModeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function RootContent() {
  const { isOverlayOpen } = useOverlayState();

  return (
    <>
      <motion.div
        className="min-h-screen w-full origin-top"
        animate={{ scale: isOverlayOpen ? 0.94 : 1, borderRadius: isOverlayOpen ? 24 : 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 28, mass: 0.9 }}
      >
        <Outlet />
      </motion.div>
      <UndoToast />
    </>
  );
}