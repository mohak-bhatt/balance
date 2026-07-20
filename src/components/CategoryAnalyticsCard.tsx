import { motion } from "framer-motion";
import { useMemo } from "react";
import { X } from "lucide-react";
import { Icon } from "./Icon";
import { formatCurrency, getCategory, type Transaction } from "@/lib/ledger";
import { useCategoryColor } from "@/lib/themes";

interface Props {
  categoryKey: string;
  transactions: Transaction[];
  onClear: () => void;
}

export function CategoryAnalyticsCard({ categoryKey, transactions, onClear }: Props) {
  const cat = getCategory(categoryKey);
  const themeColor = useCategoryColor();
  const color = themeColor(categoryKey);

  const { catTotal, monthTotal, topTxs } = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const thisMonth = transactions.filter(
      (t) => t.direction === "out" && new Date(t.timestamp).getTime() >= monthStart,
    );
    const monthTotal = thisMonth.reduce((s, t) => s + t.amount, 0);
    const catTxs = thisMonth.filter(
      (t) => t.category === categoryKey || t.items?.some((i) => i.category === categoryKey),
    );
    const catTotal = catTxs.reduce((s, t) => s + t.amount, 0);
    const topTxs = [...catTxs].sort((a, b) => b.amount - a.amount).slice(0, 3);
    return { catTotal, monthTotal, topTxs };
  }, [transactions, categoryKey]);

  const pct = monthTotal > 0 ? (catTotal / monthTotal) * 100 : 0;

  return (
    <motion.div
      layout
      className="rounded-[20px] border p-4"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: "rgba(255,255,255,0.06)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className="grid h-8 w-8 place-items-center rounded-full"
            style={{
              background: `color-mix(in oklab, ${color} 18%, transparent)`,
              color,
            }}
          >
            <Icon name={cat.icon} size={15} strokeWidth={1.7} />
          </span>
          <div>
            <p
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{ color: `${color}cc` }}
            >
              {cat.label}
            </p>
            <p
              className="font-mono-display text-2xl leading-none"
              style={{ color }}
            >
              {formatCurrency(catTotal)}
            </p>
          </div>
        </div>
        <button
          onClick={onClear}
          className="rounded-full p-1.5 text-muted-foreground"
          aria-label="Clear category"
        >
          <X size={14} strokeWidth={1.6} />
        </button>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{pct.toFixed(0)}% of month</span>
          <span className="font-mono-display">{formatCurrency(monthTotal)}</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, pct)}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="h-full rounded-full"
            style={{ background: color }}
          />
        </div>
      </div>

      <div className="mt-3 max-h-[120px] overflow-y-auto">
        {topTxs.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">No transactions this month.</p>
        ) : (
          <div className="space-y-1.5">
            {topTxs.map((t) => (
              <div key={t.id} className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs">{t.title}</p>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                    {new Date(t.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <p className="font-mono-display text-xs" style={{ color }}>
                  {formatCurrency(t.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
