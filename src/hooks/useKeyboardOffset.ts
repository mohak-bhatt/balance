import { useEffect, useState } from "react";

/**
 * Returns the height (px) of the on-screen keyboard, computed from the
 * difference between window.innerHeight and visualViewport.height.
 * Falls back to 0 on platforms without visualViewport.
 */
export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const diff = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(diff > 40 ? diff : 0);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return offset;
}
