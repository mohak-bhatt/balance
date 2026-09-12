import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Icon } from "./Icon";
import type { CategoryDef } from "@/lib/ledger";

interface Props {
  categories: CategoryDef[];
  selectedKey: string;
  onSelect: (category: CategoryDef) => void;
  colorFor?: (key: string) => string;
  label?: string;
  compact?: boolean;
}

const GROUPS: { label: string; keys: string[] }[] = [
  { label: "Food & drink", keys: ["food", "groceries", "beverages", "desserts_sweets", "coffee_snacks"] },
  { label: "Getting around", keys: ["transport", "fuel", "travel"] },
  { label: "Home & life", keys: ["shopping", "clothing", "electronics", "stationery", "bills", "rent", "subscriptions", "entertainment", "fitness", "medical", "education", "gifts", "personal_care", "pets", "home_repair", "childcare"] },
  { label: "Money in", keys: ["pocket_money", "salary", "gift_in", "refund", "loan_repaid", "other_income"] },
];

function groupFor(category: CategoryDef): string {
  return GROUPS.find((group) => group.keys.includes(category.key))?.label ?? "Other";
}

export function CategoryPicker({ categories, selectedKey, onSelect, colorFor, label = "Category", compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const selected = categories.find((category) => category.key === selectedKey) ?? categories[0];
  const groups = useMemo(() => {
    const grouped = new Map<string, CategoryDef[]>();
    for (const category of categories) {
      const group = groupFor(category);
      if (!grouped.has(group)) grouped.set(group, []);
      grouped.get(group)!.push(category);
    }
    return Array.from(grouped.entries());
  }, [categories]);

  if (!selected) return null;
  const selectedColor = colorFor?.(selected.key) ?? selected.color;
  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      </div>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex h-14 w-full items-center gap-3 rounded-2xl border px-3 text-left transition-colors"
        style={{
          borderColor: `${selectedColor}88`,
          background: `color-mix(in oklab, ${selectedColor} 13%, transparent)`,
          color: selectedColor,
        }}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-current/30 bg-black/10">
          <Icon name={selected.icon} size={17} strokeWidth={1.6} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{selected.label}</span>
          <span className="block text-[10px] uppercase tracking-[0.16em] opacity-60">Selected category</span>
        </span>
        <ChevronDown size={17} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className={`${compact ? "max-h-[min(34vh,18rem)]" : "max-h-[min(52vh,25rem)]"} mt-3 space-y-4 overflow-y-auto overscroll-contain pr-1`}>
              {groups.map(([group, groupCategories]) => (
                <section key={group}>
                  <p className="sticky top-0 z-10 mb-2 bg-transparent py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {group}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {groupCategories.map((category) => {
                      const color = colorFor?.(category.key) ?? category.color;
                      const isSelected = category.key === selectedKey;
                      return (
                        <button
                          key={category.key}
                          type="button"
                          onClick={() => { onSelect(category); setOpen(false); }}
                          className={`flex ${compact ? "h-11" : "h-12"} items-center gap-2 rounded-2xl border px-2.5 text-left text-foreground/85 transition-colors active:scale-[0.98]`}
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
        )}
      </AnimatePresence>
    </div>
  );
}