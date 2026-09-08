import { App } from "@capacitor/app";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface OverlayContextValue {
  activeCount: number;
  registerOverlay: (onClose?: () => void) => () => void;
}

const OverlayContext = createContext<OverlayContextValue>({
  activeCount: 0,
  registerOverlay: () => () => {},
});

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [activeCount, setActiveCount] = useState(0);
  const closeHandlers = useRef<Array<() => void>>([]);

  const registerOverlay = useCallback((onClose?: () => void) => {
    const close = onClose ?? (() => {});
    closeHandlers.current.push(close);
    setActiveCount((count) => count + 1);
    let registered = true;

    return () => {
      if (!registered) return;
      registered = false;
      const index = closeHandlers.current.indexOf(close);
      if (index >= 0) closeHandlers.current.splice(index, 1);
      setActiveCount((count) => Math.max(0, count - 1));
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    let listener: { remove: () => Promise<void> } | undefined;
    App.addListener("backButton", () => {
      closeHandlers.current.at(-1)?.();
    }).then((handle) => {
      if (disposed) void handle.remove();
      else listener = handle;
    });
    return () => {
      disposed = true;
      void listener?.remove();
    };
  }, []);

  const value = useMemo(() => ({ activeCount, registerOverlay }), [activeCount, registerOverlay]);

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlayState(open = false, onClose?: () => void) {
  const { activeCount, registerOverlay } = useContext(OverlayContext);
  const closeRef = useRef(onClose);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    return registerOverlay(() => closeRef.current?.());
  }, [open, registerOverlay]);

  return { isOverlayOpen: activeCount > 0, activeCount };
}
