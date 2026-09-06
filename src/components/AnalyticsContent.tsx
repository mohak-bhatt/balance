import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar,
} from "recharts";
import {
  loadState, getCategory, formatCurrency, type Transaction,
} from "@/lib/ledger";
import { useCategoryColor } from "@/lib/themes";
import { haptic } from "@/lib/haptics";
import { ScrollReveal } from "@/components/ScrollReveal";

type Tab = "weekly" | "monthly";

interface AnalyticsContentProps {
  initialTab?: Tab;
}

export function AnalyticsContent({ initialTab }: AnalyticsContentProps) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "weekly");
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const color = useCategoryColor();

  useEffect(() => { setTxs(loadState().transactions); }, []);
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  return (
    <div
      className="relative mx-auto min-h-screen w-full max-w-md px-5 pb-32"
      style={{ paddingTop: 52 }}
    >
      <div className="relative z-30 text-center">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Analytics</p>
      </div>


      <div className="mt-6 flex rounded-full border border-white/10 p-1">
        {(["weekly", "monthly"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); haptic("tick"); }}
            className={`relative flex-1 rounded-full py-2 text-xs uppercase tracking-[0.18em] transition-colors ${
              tab === t ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {tab === t && (
              <motion.span
                layoutId="analyticsTabIndicator"
                className="absolute inset-0 rounded-full bg-white/10"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10">{t}</span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "weekly" ? (
          <Weekly txs={txs} color={color} weekOffset={weekOffset} setWeekOffset={setWeekOffset} />
        ) : (
          <Monthly txs={txs} color={color} monthOffset={monthOffset} setMonthOffset={setMonthOffset} />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="w-full px-2 text-center">
      <p className="text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="text-center font-mono-display text-lg tabular-nums">{value}</p>
    </div>
  );
}

function PeriodNavigation({
  label, offset, onPrevious, onNext,
}: { label: string; offset: number; onPrevious: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/10 px-2 py-1">
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Previous period"
        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
      >
        <ChevronLeft size={16} />
      </button>
      <p className="text-xs tabular-nums text-foreground/80">{label}</p>
      <button
        type="button"
        onClick={onNext}
        disabled={offset === 0}
        aria-label="Next period"
        className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition hover:bg-white/10 hover:text-foreground disabled:opacity-25"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function formatPercentChange(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "—" : "+100%";
  const change = ((current - previous) / previous) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`;
}

function Weekly({
  txs, color, weekOffset, setWeekOffset,
}: {
  txs: Transaction[];
  color: (k: string) => string;
  weekOffset: number;
  setWeekOffset: (offset: number) => void;
}) {
  const monday = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7) - weekOffset * 7);
    date.setHours(0, 0, 0, 0);
    return date;
  }, [weekOffset]);
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  const previousMonday = new Date(monday);
  previousMonday.setDate(monday.getDate() - 7);
  const periodLabel = `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(nextMonday.getTime() - 1).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  const data = useMemo(() => {
    const out: { day: string; spend: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const spend = txs
        .filter((t) => t.direction === "out")
        .filter((t) => {
          const ts = new Date(t.timestamp).getTime();
          return ts >= d.getTime() && ts < next.getTime();
        })
        .reduce((s, t) => s + t.amount, 0);
      out.push({ day: d.toLocaleDateString("en-US", { weekday: "short" }), spend });
    }
    return out;
  }, [txs, monday]);

  const total = data.reduce((s, d) => s + d.spend, 0);
  const avg = total / 7;

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of txs) {
      if (t.direction !== "out") continue;
      const timestamp = new Date(t.timestamp).getTime();
      if (timestamp < monday.getTime() || timestamp >= nextMonday.getTime()) continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({ key: k, label: getCategory(k).label, v }))
      .sort((a, b) => b.v - a.v);
  }, [txs, monday, nextMonday]);

  const biggest = useMemo(() => {
    return txs
      .filter((t) => {
        const timestamp = new Date(t.timestamp).getTime();
        return t.direction === "out" && timestamp >= monday.getTime() && timestamp < nextMonday.getTime();
      })
      .sort((a, b) => b.amount - a.amount)[0];
  }, [txs, monday, nextMonday]);

  const currentTxs = txs.filter((t) => {
    const timestamp = new Date(t.timestamp).getTime();
    return t.direction === "out" && timestamp >= monday.getTime() && timestamp < nextMonday.getTime();
  });
  const previousTxs = txs.filter((t) => {
    const timestamp = new Date(t.timestamp).getTime();
    return t.direction === "out" && timestamp >= previousMonday.getTime() && timestamp < monday.getTime();
  });
  const previousTotal = previousTxs.reduce((sum, t) => sum + t.amount, 0);
  const mostUsed = breakdown[0];
  const busiestDay = data.reduce((best, day) => day.spend > best.spend ? day : best, data[0]);
  const previousFourWeekTotal = txs.filter((t) => {
    const timestamp = new Date(t.timestamp).getTime();
    const fourWeeksAgo = new Date(monday); fourWeeksAgo.setDate(monday.getDate() - 28);
    return t.direction === "out" && timestamp >= fourWeeksAgo.getTime() && timestamp < monday.getTime();
  }).reduce((sum, t) => sum + t.amount, 0);
  const insights = [
    currentTxs.length > 0 && busiestDay.spend > 0
      ? `You spend most on ${busiestDay.day}s`
      : "No spending pattern yet this week",
    mostUsed && total > 0
      ? `${mostUsed.label} accounts for ${Math.round((mostUsed.v / total) * 100)}% of this week's spend`
      : "Add an expense to reveal your spending mix",
    previousFourWeekTotal > 0 && total > previousFourWeekTotal / 4
      ? `This week's spend is above your 4-week average`
      : null,
  ].filter((insight): insight is string => Boolean(insight));

  return (
    <div className="space-y-7">
      <ScrollReveal once>
      <PeriodNavigation
        label={periodLabel}
        offset={weekOffset}
        onPrevious={() => setWeekOffset(weekOffset + 1)}
        onNext={() => setWeekOffset(Math.max(0, weekOffset - 1))}
      />
      </ScrollReveal>

      <ScrollReveal once>
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="h-44 w-full">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gw" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fill: "#888", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1 }}
              contentStyle={{ background: "#111", border: "1px solid #222", fontSize: 11, borderRadius: 8 }}
              labelStyle={{ color: "#aaa" }}
            />

            <Area type="monotone" dataKey="spend" stroke="#fff" strokeWidth={1.5} fill="url(#gw)" />
          </AreaChart>
        </ResponsiveContainer>
        </div>
      </div>
      </ScrollReveal>

      <ScrollReveal>
        <SegmentedBar items={breakdown} color={color} />
      </ScrollReveal>

      <Insights items={insights} />

      {biggest && (
        <ScrollReveal>
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Biggest expense</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm">{biggest.title}</p>
            <p className="font-mono-display text-base">{formatCurrency(biggest.amount)}</p>
          </div>
        </div>
        </ScrollReveal>
      )}

      <ScrollReveal>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="grid grid-cols-2 items-center divide-x divide-white/10">
            <Stat label="Period spent" value={formatCurrency(total)} />
            <Stat label="Daily average" value={formatCurrency(avg)} />
          </div>
        </div>
      </ScrollReveal>
      <ScrollReveal>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="grid grid-cols-2 items-center divide-x divide-white/10">
            <Stat label="Change vs prior" value={formatPercentChange(total, previousTotal)} />
            <Stat label="Expense count" value={String(currentTxs.length)} />
          </div>
        </div>
      </ScrollReveal>
      <ScrollReveal>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="grid grid-cols-2 items-center divide-x divide-white/10">
            <Stat label="Average expense" value={formatCurrency(currentTxs.length ? total / currentTxs.length : 0)} />
            <Stat label="Top category" value={mostUsed?.label ?? "—"} />
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}

function Monthly({
  txs, color, monthOffset, setMonthOffset,
}: {
  txs: Transaction[];
  color: (k: string) => string;
  monthOffset: number;
  setMonthOffset: (offset: number) => void;
}) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
  const monthEndExclusive = new Date(now.getFullYear(), now.getMonth() - monthOffset + 1, 1);
  const monthEnd = new Date(monthEndExclusive.getTime() - 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - monthOffset - 1, 1);
  const periodLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const monthTxs = txs.filter((t) => {
    const date = new Date(t.timestamp);
    return date >= monthStart && date < monthEndExclusive;
  });
  const lastTxs = txs.filter((t) => {
    const d = new Date(t.timestamp);
    return d >= lastMonthStart && d < monthStart;
  });

  const data = useMemo(() => {
    const arr: { d: string; spend: number }[] = [];
    for (let i = 1; i <= monthEnd.getDate(); i++) {
      const d = new Date(monthStart.getFullYear(), monthStart.getMonth(), i);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      const spend = txs
        .filter((t) => t.direction === "out")
        .filter((t) => {
          const ts = new Date(t.timestamp).getTime();
          return ts >= d.getTime() && ts < next.getTime();
        })
        .reduce((s, t) => s + t.amount, 0);
      arr.push({ d: String(i), spend });
    }
    return arr;
  }, [txs, monthStart, monthEnd]);

  const total = monthTxs.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  const lastTotal = lastTxs.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  const dayOfMonth = monthOffset === 0 ? now.getDate() : monthEnd.getDate();
  const projected = total > 0 ? (total / dayOfMonth) * monthEnd.getDate() : 0;

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of monthTxs) {
      if (t.direction !== "out") continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({ key: k, label: getCategory(k).label, v }))
      .sort((a, b) => b.v - a.v);
  }, [monthTxs]);

  const topTxs = useMemo(
    () => monthTxs.filter((t) => t.direction === "out").sort((a, b) => b.amount - a.amount).slice(0, 3),
    [monthTxs],
  );
  const currentOutTxs = monthTxs.filter((t) => t.direction === "out");
  const mostUsed = breakdown[0];
  const busiestDay = data.reduce((best, day) => day.spend > best.spend ? day : best, data[0]);
  const insights = [
    currentOutTxs.length > 0 && busiestDay.spend > 0
      ? `Your highest-spend day was the ${busiestDay.d}${busiestDay.d.endsWith("1") ? "st" : busiestDay.d.endsWith("2") ? "nd" : busiestDay.d.endsWith("3") ? "rd" : "th"}`
      : "No spending pattern yet this month",
    mostUsed && total > 0
      ? `${mostUsed.label} accounts for ${Math.round((mostUsed.v / total) * 100)}% of this month's spend`
      : "Add an expense to reveal your spending mix",
    lastTotal > 0 && total > lastTotal * 1.5 ? "This month's spend is more than 50% above last month" : null,
  ].filter((insight): insight is string => Boolean(insight));

  return (
    <div className="space-y-7">
      <ScrollReveal once>
      <PeriodNavigation
        label={periodLabel}
        offset={monthOffset}
        onPrevious={() => setMonthOffset(monthOffset + 1)}
        onNext={() => setMonthOffset(Math.max(0, monthOffset - 1))}
      />
      </ScrollReveal>
      <ScrollReveal once>
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <div className="h-44 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="d" tick={{ fill: "#666", fontSize: 9 }} interval={3} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.06)", radius: 4 }}
              contentStyle={{ background: "#111", border: "1px solid #222", fontSize: 11, borderRadius: 8 }}
              labelStyle={{ color: "#aaa" }}
            />
            <Bar dataKey="spend" fill="#fff" fillOpacity={0.7} radius={[2, 2, 0, 0]} maxBarSize={14} />

          </BarChart>
        </ResponsiveContainer>
        </div>
      </div>
      </ScrollReveal>

      <ScrollReveal>
        <SegmentedBar items={breakdown} color={color} />
      </ScrollReveal>

      <Insights items={insights} />

      {topTxs.length > 0 && (
        <ScrollReveal>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Top transactions</p>
          <div className="mt-3 space-y-2">
            {topTxs.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                <p className="text-sm">{t.title}</p>
                <p className="font-mono-display text-sm">{formatCurrency(t.amount)}</p>
              </div>
            ))}
          </div>
        </div>
        </ScrollReveal>
      )}

      <ScrollReveal>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="grid grid-cols-2 items-center divide-x divide-white/10">
            <Stat label="Month spent" value={formatCurrency(total)} />
            <Stat label="Projected total" value={formatCurrency(projected)} />
          </div>
        </div>
      </ScrollReveal>
      <ScrollReveal>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="grid grid-cols-2 items-center divide-x divide-white/10">
            <Stat label="Change vs prior" value={formatPercentChange(total, lastTotal)} />
            <Stat label="Expense count" value={String(currentOutTxs.length)} />
          </div>
        </div>
      </ScrollReveal>
      <ScrollReveal>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="grid grid-cols-2 items-center divide-x divide-white/10">
            <Stat label="Average expense" value={formatCurrency(currentOutTxs.length ? total / currentOutTxs.length : 0)} />
            <Stat label="Top category" value={mostUsed?.label ?? "—"} />
          </div>
        </div>
      </ScrollReveal>
    </div>
  );
}

function SegmentedBar({
  items, color,
}: { items: { key: string; label: string; v: number }[]; color: (k: string) => string }) {
  const [expanded, setExpanded] = useState(false);
  const total = items.reduce((sum, item) => sum + item.v, 0);
  if (total === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Spending mix</p>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={expanded ? "Collapse spending mix" : "Expand spending mix"}
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setExpanded((value) => !value);
          }
        }}
        className="cursor-pointer"
      >
        <div className="mt-3 flex h-5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        {items.map((item, index) => (
          <motion.div
            key={item.key}
            initial={{ width: 0 }}
            animate={{ width: `${(item.v / total) * 100}%` }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: index * 0.06 }}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ background: color(item.key) }}
            title={`${item.label}: ${formatCurrency(item.v)}`}
          />
        ))}
        </div>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2 pb-1">
                {items.map((item) => (
                  <div key={item.key} className="flex items-center gap-2 text-base">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color(item.key) }} />
                    <span className="min-w-0 flex-1 truncate leading-tight">{item.label}</span>
                    <span className="font-mono-display text-muted-foreground leading-tight">
                      {Math.round((item.v / total) * 100)}%
                    </span>
                    <span className="font-mono-display text-sm">{formatCurrency(item.v)}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Insights({ items }: { items: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <ScrollReveal>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Insights</p>
      </ScrollReveal>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <ScrollReveal key={item}>
            <div className="rounded-xl border border-white/10 px-4 py-3 text-sm text-foreground/85">
              {item}
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}