import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Undo2, Check } from "lucide-react";
import { getUndo, performUndo, subscribeUndo } from "@/lib/undo";


export function UndoToast() {
  const pending = useSyncExternalStore(subscribeUndo, getUndo, getUndo);
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (!pending) return;
    const total = pending.expiresAt - Date.now();
    let raf = 0;
    const tick = () => {
      const left = Math.max(0, pending.expiresAt - Date.now());
      setProgress(total > 0 ? left / total : 0);
      if (left > 0) raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [pending]);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-40 flex justify-center px-6"
      style={{ bottom: "calc(max(env(safe-area-inset-bottom), 1.25rem) + 7rem)" }}

    >
      <AnimatePresence>
        {pending && (
          <motion.div
            key={pending.id}
            initial={{ y: 24, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="pointer-events-auto relative flex w-full max-w-sm items-center gap-3 overflow-hidden rounded-full border border-white/12 bg-black/70 px-4 py-3 backdrop-blur-xl"
          >
            <span className="text-sm text-white/85">{pending.label}</span>
            {pending.onUndo ? (
              <button
                onClick={performUndo}
                className="ml-auto flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/90 active:opacity-60"
              >
                <Undo2 size={12} strokeWidth={1.8} />
                Undo
              </button>
            ) : (
              <span className="ml-auto grid h-6 w-6 place-items-center rounded-full bg-white/10 text-white/85">
                <Check size={12} strokeWidth={2} />
              </span>
            )}

            <motion.span
              className="absolute inset-x-0 bottom-0 h-[2px] origin-left bg-white/40"
              style={{ scaleX: progress }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}