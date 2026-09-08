import { App } from "@capacitor/app";
import { useEffect, useRef } from "react";

export function useRouteBackToHome(navigateToHome: () => void) {
  const navigateRef = useRef(navigateToHome);

  useEffect(() => {
    navigateRef.current = navigateToHome;
  }, [navigateToHome]);

  useEffect(() => {
    let disposed = false;
    let nativeHandle: { remove: () => Promise<void> } | undefined;

    App.addListener("backButton", () => {
      navigateRef.current();
    }).then((handle) => {
      if (disposed) {
        void handle.remove();
      } else {
        nativeHandle = handle;
      }
    });

    let startX = 0;
    let startY = 0;
    let trackingEdgeSwipe = false;

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || event.clientX > 28) return;
      startX = event.clientX;
      startY = event.clientY;
      trackingEdgeSwipe = true;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!trackingEdgeSwipe) return;
      const dx = event.clientX - startX;
      const dy = Math.abs(event.clientY - startY);
      if (dy > 48 || dx < 0) trackingEdgeSwipe = false;
      if (dx > 80 && dy < 48) {
        trackingEdgeSwipe = false;
        navigateRef.current();
      }
    };
    const stopTracking = () => { trackingEdgeSwipe = false; };

    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerup", stopTracking, { passive: true });
    document.addEventListener("pointercancel", stopTracking, { passive: true });

    return () => {
      disposed = true;
      void nativeHandle?.remove();
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", stopTracking);
      document.removeEventListener("pointercancel", stopTracking);
    };
  }, []);
}
