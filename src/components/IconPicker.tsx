import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, X } from "lucide-react";
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
  const [q, setQ] = useState("");
  useBodyScrollLock(open);

  useEffect(() => { if (!open) setQ(""); }, [open]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return ICON_LIBRARY;
    return ICON_LIBRARY.filter((n) => n.toLowerCase().includes(s));
  }, [q]);

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
            className="fixed inset-x-0 bottom-0 z-[61] max-h-[80vh] rounded-t-[28px] glass-strong p-4"
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-white/15" />
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Choose an icon</h3>
              <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-white/5">
                <X size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] px-3 py-2">
              <Search size={14} className="text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search icons"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="mt-3 grid max-h-[55vh] grid-cols-6 gap-2 overflow-y-auto pb-2">
              {filtered.map((name) => {
                const isSel = name === selected;
                return (
                  <motion.button
                    key={name}
                    whileTap={{ scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 500, damping: 16 }}
                    onClick={() => { onSelect(name); onClose(); }}
                    className={`grid aspect-square place-items-center rounded-2xl ${
                      isSel
                        ? "bg-primary/15 ring-2 ring-primary"
                        : "bg-white/[0.03] ring-1 ring-white/[0.04]"
                    }`}
                  >
                    <Icon name={name} size={20} className={isSel ? "text-primary" : ""} />
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
