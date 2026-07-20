import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { Icon } from "./Icon";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/ledger";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (m: PaymentMethod) => void;
}

export function FavoritePaymentPopup({ open, onClose, onPick }: Props) {
  useBodyScrollLock(open);

  const node = (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="fixed inset-0 z-[80]"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="liquid-glass fixed left-1/2 top-1/2 z-[85] w-[86vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Pay with?
              </p>
              <button onClick={onClose} aria-label="Cancel" className="rounded-full p-1.5 text-muted-foreground">
                <X size={14} strokeWidth={1.6} />
              </button>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {PAYMENT_METHODS.map((m) => (
                <motion.button
                  key={m.key}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => onPick(m.key)}
                  className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-2 text-xs text-foreground/90"
                >
                  <Icon name={m.icon} size={12} strokeWidth={1.6} />
                  {m.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}
