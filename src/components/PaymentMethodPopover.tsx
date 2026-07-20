import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { ChevronRight, X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { Icon } from "./Icon";
import {
  PAYMENT_METHODS,
  formatCurrency,
  type BalancesByMethod,
  type PaymentMethod,
} from "@/lib/ledger";


interface Props {
  open: boolean;
  onClose: () => void;
  balances: BalancesByMethod;
  onAddMoney: (m?: PaymentMethod) => void;
}

export function PaymentMethodPopover({ open, onClose, balances, onAddMoney }: Props) {
  useBodyScrollLock(open);

  const node = (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="fixed inset-0 z-[55] bg-black/55 backdrop-blur-md"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="liquid-glass fixed left-1/2 top-24 z-[60] w-[88vw] max-w-sm -translate-x-1/2 rounded-3xl p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                By payment method
              </p>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-muted-foreground"
                aria-label="Close"
              >
                <X size={14} strokeWidth={1.6} />
              </button>
            </div>

            <ul className="mt-3 space-y-1">
              {PAYMENT_METHODS.map((m) => (
                <li key={m.key}>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 380, damping: 20 }}
                    onClick={() => onAddMoney(m.key)}
                    className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left active:bg-white/5"
                    aria-label={`Add money to ${m.label}`}
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10">
                      <Icon name={m.icon} size={13} strokeWidth={1.5} />
                    </span>
                    <p className="flex-1 text-sm">{m.label}</p>
                    <p className="font-mono-display text-sm tabular-nums text-foreground/90">
                      {formatCurrency(balances[m.key])}
                    </p>
                    <ChevronRight size={14} strokeWidth={1.6} className="text-muted-foreground/50" />
                  </motion.button>
                </li>
              ))}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}
