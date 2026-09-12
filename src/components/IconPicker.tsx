import { AnimatePresence, motion } from "framer-motion";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { Icon } from "./Icon";
import { ICON_LIBRARY } from "@/lib/ledger";

interface Props {
  open: boolean;
  selected: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}

export function IconPicker({ open, selected, onSelect, onClose }: Props) {
  useBodyScrollLock(open);

  const node = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="fixed inset-x-0 bottom-0 z-[61] max-h-[80vh] overflow-x-hidden overflow-y-auto rounded-t-[28px] border-t border-white/10 p-4"
            style={{
              background: "rgba(15, 15, 15, 0.65)",
              backdropFilter: "blur(10px) saturate(150%)",
              WebkitBackdropFilter: "blur(10px) saturate(150%)",
              borderColor: "rgba(255,255,255,0.08)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 -20px 60px -20px rgba(0,0,0,0.8)",
            }}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/15" />
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-mono-display text-xl text-foreground/95">CHOOSE AN ICON</h3>
              <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-white/5">
                <X size={16} />
              </button>
            </div>
            <div className="grid max-h-[60vh] grid-cols-5 gap-3 overflow-y-auto pb-2">
              {ICON_LIBRARY.map((name) => {
                const isSel = name === selected;
                return (
                  <motion.button
                    key={name}
                    whileTap={{ scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 500, damping: 16 }}
                    onClick={() => { onSelect(name); onClose(); }}
                    className={`grid aspect-square place-items-center rounded-full ${
                      isSel
                        ? "bg-white/15 ring-2 ring-white/60"
                        : "bg-white/[0.03] ring-1 ring-white/[0.08]"
                    }`}
                  >
                    <Icon name={name} size={19} className={isSel ? "text-foreground" : "text-foreground/70"} />
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}