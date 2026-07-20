import { useEffect } from "react";

let lockCount = 0;
let scrollY = 0;
let bodyInline = "";
let htmlInline = "";

/**
 * Locks the page behind the calling overlay so the user cannot scroll it.
 * Safe to call from multiple nested overlays: the lock is released only when
 * the last one unmounts.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    if (lockCount === 0) {
      scrollY = window.scrollY ?? 0;
      const body = document.body;
      const html = document.documentElement;
      bodyInline = body.style.cssText;
      htmlInline = html.style.cssText;

      body.style.position = "fixed";
      body.style.top = `-${scrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      body.style.touchAction = "none";
      body.style.overscrollBehavior = "none";

      html.style.overflow = "hidden";
      html.style.height = "100%";
      html.style.overscrollBehavior = "none";
    }
    lockCount++;

    return () => {
      lockCount--;
      if (lockCount === 0) {
        document.body.style.cssText = bodyInline;
        document.documentElement.style.cssText = htmlInline;
        window.scrollTo(0, scrollY);
      }
    };
  }, [locked]);
}
