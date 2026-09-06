import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface OverlayContextValue {
  activeCount: number;
  registerOverlay: () => () => void;
}

const OverlayContext = createContext<OverlayContextValue>({
  activeCount: 0,
  registerOverlay: () => () => {},
});

export function OverlayProvider({ children }: { children: React.ReactNode }) {
  const [activeCount, setActiveCount] = useState(0);

  const registerOverlay = useCallback(() => {
    setActiveCount((count) => count + 1);
    let registered = true;

    return () => {
      if (!registered) return;
      registered = false;
      setActiveCount((count) => Math.max(0, count - 1));
    };
  }, []);

  const value = useMemo(() => ({ activeCount, registerOverlay }), [activeCount, registerOverlay]);

  return <OverlayContext.Provider value={value}>{children}</OverlayContext.Provider>;
}

export function useOverlayState(open = false) {
  const { activeCount, registerOverlay } = useContext(OverlayContext);

  useEffect(() => {
    if (!open) return;
    return registerOverlay();
  }, [open, registerOverlay]);

  return { isOverlayOpen: activeCount > 0, activeCount };
}
