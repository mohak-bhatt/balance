import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, BarChart, Bar, Cell,
} from "recharts";
import {
  loadState, getCategory, formatCurrency, type Transaction,
} from "@/lib/ledger";
import { useCategoryColor } from "@/lib/themes";
import { haptic } from "@/lib/haptics";

type Tab = "weekly" | "monthly";

export function AnalyticsContent() {
  const [tab, setTab] = useState<Tab>("weekly");
  const [txs, setTxs] = useState<Transaction[]>([]);
  const color = useCategoryColor();

  useEffect(() => { setTxs(loadState().transactions); }, []);

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
        {tab === "weekly" ? <Weekly txs={txs} color={color} /> : <Monthly txs={txs} color={color} />}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="font-mono-display text-lg tabular-nums">{value}</p>
    </div>
  );
}

function Weekly({ txs, color }: { txs: Transaction[]; color: (k: string) => string }) {
  const data = useMemo(() => {
    const out: { day: string; spend: number }[] = [];
    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
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
  }, [txs]);

  const total = data.reduce((s, d) => s + d.spend, 0);
  const avg = total / 7;

  const breakdown = useMemo(() => {
    const map = new Map<string, number>();
    const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    for (const t of txs) {
      if (t.direction !== "out") continue;
      if (new Date(t.timestamp).getTime() < monday.getTime()) continue;
      map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({ key: k, label: getCategory(k).label, v }))
      .sort((a, b) => b.v - a.v);
  }, [txs]);

  const biggest = useMemo(() => {
    const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    return txs
      .filter((t) => t.direction === "out" && new Date(t.timestamp).getTime() >= monday.getTime())
      .sort((a, b) => b.amount - a.amount)[0];
  }, [txs]);

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Total" value={formatCurrency(total)} />
        <Stat label="Daily avg" value={formatCurrency(avg)} />
      </div>

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

      <Breakdown items={breakdown} color={color} />

      {biggest && (
        <div className="rounded-2xl border border-white/10 p-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Biggest expense</p>
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm">{biggest.title}</p>
            <p className="font-mono-display text-base">{formatCurrency(biggest.amount)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Monthly({ txs, color }: { txs: Transaction[]; color: (k: string) => string }) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const monthTxs = txs.filter((t) => new Date(t.timestamp) >= monthStart);
  const lastTxs = txs.filter((t) => {
    const d = new Date(t.timestamp);
    return d >= lastMonthStart && d < monthStart;
  });

  const data = useMemo(() => {
    const arr: { d: string; spend: number }[] = [];
    for (let i = 1; i <= monthEnd.getDate(); i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txs]);

  const total = monthTxs.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  const lastTotal = lastTxs.filter((t) => t.direction === "out").reduce((s, t) => s + t.amount, 0);
  const dayOfMonth = now.getDate();
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

  return (
    <div className="space-y-7">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Spent" value={formatCurrency(total)} />
        <Stat label="Projected" value={formatCurrency(projected)} />
      </div>
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

      <div>
        <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">vs last month</p>
        <p className="mt-1 font-mono-display text-base">
          {lastTotal === 0
            ? "—"
            : `${total >= lastTotal ? "+" : ""}${formatCurrency(total - lastTotal)}`}
        </p>
      </div>

      <Breakdown items={breakdown.slice(0, 3)} color={color} title="Top categories" />

      {topTxs.length > 0 && (
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
      )}
    </div>
  );
}

function Breakdown({
  items, color, title = "Categories",
}: { items: { key: string; label: string; v: number }[]; color: (k: string) => string; title?: string }) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.v));
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <div className="mt-3 space-y-2">
        {items.map((it) => (
          <div key={it.key}>
            <div className="flex items-center justify-between">
              <p className="text-xs">{it.label}</p>
              <p className="font-mono-display text-xs">{formatCurrency(it.v)}</p>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full"
                style={{ width: `${(it.v / max) * 100}%`, background: color(it.key) }}
              />
            </div>
          </div>
        ))}
      </div>
      <span className="hidden"><Cell /></span>
    </div>
  );
}
