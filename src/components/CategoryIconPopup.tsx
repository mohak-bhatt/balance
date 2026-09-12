import { AnimatePresence, motion } from "framer-motion";
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Icon } from "./Icon";
import { GROUPS, groupFor } from "./CategoryPicker";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { CategoryDef } from "@/lib/ledger";

interface Props {
  open: boolean;
  categories: CategoryDef[];
  selectedKey: string;
  colorFor: (key: string) => string;
  onSelect: (category: CategoryDef) => void;
  onClose: () => void;
}

/** Bottom-sheet popup for picking a category by icon, grouped like the icon picker. */
export function CategoryIconPopup({
  open, categories, selectedKey, colorFor, onSelect, onClose,
}: Props) {
  useBodyScrollLock(open);
  const groups = useMemo(() => {
    const grouped = new Map<string, CategoryDef[]>();
    for (const category of categories) {
      const group = groupFor(category);
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)!.push(category);
    }
    return Array.from(grouped.entries());
  }, [categories]);

  const node = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[150] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="fixed inset-x-0 bottom-0 z-[151] max-h-[80vh] overflow-x-hidden overflow-y-auto rounded-t-[28px] border-t border-white/10 p-4"
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
              <h3 className="font-mono-display text-xl text-foreground/95">CATEGORY</h3>
              <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-white/5">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[60vh] space-y-4 overflow-y-auto pb-2">
              {groups.map(([group, groupCategories]) => (
                <section key={group}>
                  <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {group}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {groupCategories.map((category) => {
                      const color = colorFor(category.key);
                      const isSelected = category.key === selectedKey;
                      return (
                        <button
                          key={category.key}
                          type="button"
                          onClick={() => { onSelect(category); onClose(); }}
                          className="flex h-12 items-center gap-2 rounded-2xl border px-2.5 text-left text-foreground/85 transition-colors active:scale-[0.98]"
                          style={isSelected ? {
                            borderColor: color,
                            background: `color-mix(in oklab, ${color} 18%, transparent)`,
                          } : {
                            borderColor: "rgba(255,255,255,0.09)",
                            background: "rgba(255,255,255,0.035)",
                          }}
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-white/15 bg-black/10" style={{ color }}>
                            <Icon name={category.icon} size={15} strokeWidth={1.55} />
                          </span>
                          <span className="min-w-0 truncate text-xs font-medium text-foreground/85">{category.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
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