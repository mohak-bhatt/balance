import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";

interface Step {
  target: string; // data-tutorial value to find
  title: string;
  body: string;
  padding?: number;
}

const STEPS: Step[] = [
  { target: "donut", title: "Your donut", body: "This shows what you've spent this month, broken down by category. Tap a segment to drill in.", padding: 10 },
  { target: "favorites", title: "Favourites", body: "Tap a favourite to log it instantly. Add your own from Settings.", padding: 8 },
  { target: "loops", title: "Loops", body: "Loops auto-apply recurring transactions — like pocket money or subscriptions.", padding: 8 },
  { target: "history", title: "History", body: "See every transaction, grouped by month.", padding: 6 },
  { target: "analytics", title: "Analytics", body: "Detailed weekly and monthly spending breakdowns.", padding: 6 },
  { target: "plus", title: "Add a spend", body: "Tap to log a spend.", padding: 6 },
  { target: "balance", title: "Balance", body: "Tap your balance to see it broken down by payment method.", padding: 6 },
];

interface Rect { x: number; y: number; w: number; h: number; }

function rectOf(target: string, padding: number): Rect | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector(`[data-tutorial="${target}"]`) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    x: r.left - padding,
    y: r.top - padding,
    w: r.width + padding * 2,
    h: r.height + padding * 2,
  };
}

export function Tutorial() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem("balance:startTutorial") === "1") {
      localStorage.removeItem("balance:startTutorial");
      // Small delay so target elements have mounted
      setTimeout(() => setOpen(true), 250);
    }
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const step = STEPS[i];
    let raf = 0;
    const measure = () => {
      const r = rectOf(step.target, step.padding ?? 8);
      setRect(r);
    };
    // Retry a couple of times in case the target is mid-mount/animation
    measure();
    const t1 = setTimeout(measure, 80);
    const t2 = setTimeout(measure, 200);
    const onResize = () => { raf = requestAnimationFrame(measure); };
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, i]);

  useBodyScrollLock(open);


  if (!open || typeof document === "undefined") return null;

  const step = STEPS[i];
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;

  // Place tooltip above the target if it's in the lower half, otherwise below.
  const tooltipBelow = rect ? rect.y + rect.h / 2 < vh / 2 : true;
  const tooltipTop = rect
    ? (tooltipBelow ? rect.y + rect.h + 16 : rect.y - 16)
    : vh / 2;

  const close = () => setOpen(false);
  const isLast = i === STEPS.length - 1;

  return createPortal(
    <div className="fixed inset-0 z-[80]" aria-modal="true" role="dialog">
      {/* SVG mask creates the spotlight cutout */}
      <svg width="100%" height="100%" className="absolute inset-0">
        <defs>
          <mask id="tutorial-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <motion.rect
                animate={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }}
                transition={{ type: "spring", stiffness: 280, damping: 28 }}
                rx="18"
                ry="18"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.78)" mask="url(#tutorial-mask)" />
      </svg>

      {/* Glow ring around the spotlit target */}
      {rect && (
        <motion.div
          animate={{ x: rect.x, y: rect.y, width: rect.w, height: rect.h }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="pointer-events-none absolute left-0 top-0 rounded-[18px]"
          style={{
            boxShadow:
              "0 0 0 1px rgba(255,255,255,0.25), 0 0 24px 4px rgba(255,255,255,0.12)",
          }}
        />
      )}

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="liquid-glass absolute left-1/2 w-[calc(100%-32px)] max-w-sm -translate-x-1/2 rounded-3xl border border-white/10 p-5"
          style={
            tooltipBelow
              ? { top: Math.min(tooltipTop, vh - 220) }
              : { top: "auto", bottom: Math.max(16, vh - tooltipTop) }
          }
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {i + 1} / {STEPS.length}
          </p>
          <p className="mt-2 font-mono-display text-lg">{step.title}</p>
          <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
          <div className="mt-5 flex items-center justify-between">
            <button onClick={close} className="text-xs text-muted-foreground">Skip</button>
            <div className="flex gap-2">
              {i > 0 && (
                <button onClick={() => setI((x) => x - 1)} className="rounded-xl border border-white/10 px-4 py-2 text-xs">
                  ← Prev
                </button>
              )}
              <button
                onClick={() => (isLast ? close() : setI((x) => x + 1))}
                className="rounded-xl bg-white px-4 py-2 text-xs font-medium text-black"
              >
                {isLast ? "Done" : "Next →"}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  );
}