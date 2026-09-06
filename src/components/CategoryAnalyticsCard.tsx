import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Icon } from "./Icon";
import { ScrollReveal } from "./ScrollReveal";
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
  const [showAll, setShowAll] = useState(false);

  const { catTotal, monthTotal, lastMonthTotal, categoryTxs, topTxs, trend } = useMemo(() => {
    const now = new Date();
    const monthStartDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const lastMonthStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthStart = monthStartDate.getTime();
    const nextMonth = nextMonthDate.getTime();

    const amountForCategory = (t: Transaction) => {
      if (!t.items?.length) return t.amount;
      return t.items
        .filter((item) => item.category === categoryKey)
        .reduce((sum, item) => sum + item.amount, 0);
    };
    const thisMonth = transactions.filter((t) => {
      const timestamp = new Date(t.timestamp).getTime();
      return t.direction === "out" && timestamp >= monthStart && timestamp < nextMonth;
    });
    const monthTotal = thisMonth.reduce((s, t) => s + t.amount, 0);
    const categoryTxs = thisMonth.filter(
      (t) => t.category === categoryKey || t.items?.some((i) => i.category === categoryKey),
    );
    const catTotal = categoryTxs.reduce((s, t) => s + amountForCategory(t), 0);
    const lastMonthTotal = transactions
      .filter((t) => {
        const timestamp = new Date(t.timestamp).getTime();
        return t.direction === "out" && timestamp >= lastMonthStartDate.getTime() && timestamp < monthStart;
      })
      .filter((t) => t.category === categoryKey || t.items?.some((i) => i.category === categoryKey))
      .reduce((s, t) => s + amountForCategory(t), 0);
    const topTxs = [...categoryTxs].sort((a, b) => amountForCategory(b) - amountForCategory(a)).slice(0, 3);
    const trend = Array.from({ length: now.getDate() }, (_, index) => {
      const day = new Date(now.getFullYear(), now.getMonth(), index + 1);
      const nextDay = new Date(day); nextDay.setDate(day.getDate() + 1);
      const spend = categoryTxs
        .filter((t) => {
          const timestamp = new Date(t.timestamp).getTime();
          return timestamp >= day.getTime() && timestamp < nextDay.getTime();
        })
        .reduce((s, t) => s + amountForCategory(t), 0);
      return { day: String(index + 1), spend };
    });
    return { catTotal, monthTotal, lastMonthTotal, categoryTxs, topTxs, trend };
  }, [transactions, categoryKey]);

  const pct = monthTotal > 0 ? (catTotal / monthTotal) * 100 : 0;
  const changePct = lastMonthTotal > 0 ? ((catTotal - lastMonthTotal) / lastMonthTotal) * 100 : null;
  const averageSize = categoryTxs.length > 0 ? catTotal / categoryTxs.length : 0;
  const visibleTxs = showAll ? [...categoryTxs].sort((a, b) => b.timestamp.localeCompare(a.timestamp)) : topTxs;

  return (
    <motion.div
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

      <ScrollReveal>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Category trend</p>
          <div className="mt-2 h-36 w-full">
            <ResponsiveContainer>
              <AreaChart data={trend} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`category-trend-${categoryKey}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: "#666", fontSize: 9 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(trend.length / 5))} />
                <YAxis hide />
                <Tooltip
                  cursor={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1 }}
                  contentStyle={{ background: "#111", border: "1px solid #222", fontSize: 11, borderRadius: 8 }}
                  labelStyle={{ color: "#aaa" }}
                  formatter={(value) => [formatCurrency(Number(value)), "Spent"]}
                />
                <Area type="monotone" dataKey="spend" stroke={color} strokeWidth={1.5} fill={`url(#category-trend-${categoryKey})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">vs last month</p>
            <p className="mt-1 font-mono-display text-base" style={{ color }}>
              {formatCurrency(catTotal - lastMonthTotal)}
            </p>
            <p className="text-[10px] text-muted-foreground">{changePct == null ? "No prior spend" : `${changePct >= 0 ? "+" : ""}${changePct.toFixed(0)}%`}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Monthly count</p>
            <p className="mt-1 font-mono-display text-base">{categoryTxs.length}</p>
            <p className="text-[10px] text-muted-foreground">{formatCurrency(averageSize)} average</p>
          </div>
        </div>
      </ScrollReveal>

      <ScrollReveal>
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.02] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Transactions</p>
            {categoryTxs.length > 3 && (
              <button
                type="button"
                onClick={() => setShowAll((value) => !value)}
                className="flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
              >
                {showAll ? "Show less" : `Show all ${categoryTxs.length}`}
                <ChevronDown size={13} className={showAll ? "rotate-180" : ""} />
              </button>
            )}
          </div>
          {categoryTxs.length === 0 ? (
            <p className="mt-3 text-[11px] text-muted-foreground">No transactions this month.</p>
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div layout className="mt-3 space-y-1.5">
                {visibleTxs.map((t, index) => (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, delay: index * 0.03 }}
                    className="flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs">{t.title}</p>
                      <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                        {new Date(t.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <p className="font-mono-display text-xs" style={{ color }}>
                      {formatCurrency(t.items?.length ? t.items.filter((item) => item.category === categoryKey).reduce((sum, item) => sum + item.amount, 0) : t.amount)}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </ScrollReveal>
    </motion.div>
  );
}
