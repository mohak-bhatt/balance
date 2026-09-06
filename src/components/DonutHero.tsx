import { motion, useSpring } from "framer-motion";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import {
  LENT_OUT_KEY,
  getCategory,
  totalSpentThisMonth,
  type Transaction,
} from "@/lib/ledger";
import { useCategoryColor } from "@/lib/themes";
import { haptic } from "@/lib/haptics";

const LENT_OUT_COLOR = "#6B7280";
let hasPlayedIntroThisSession = false;

interface Props {
  transactions: Transaction[];
  balance: number;
  lowBalanceThreshold: number;
  selected: string | null;
  onSelect: (key: string | null) => void;
  punchSignal?: number;
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}
function arcPath(cx: number, cy: number, rOuter: number, rInner: number, start: number, end: number) {
  if (end - start >= 359.999) end = start + 359.999;
  const large = end - start > 180 ? 1 : 0;
  const o1 = polar(cx, cy, rOuter, start);
  const o2 = polar(cx, cy, rOuter, end);
  const i1 = polar(cx, cy, rInner, end);
  const i2 = polar(cx, cy, rInner, start);
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i2.x} ${i2.y}`,
    "Z",
  ].join(" ");
}

export function DonutHero({
  transactions, balance, selected, onSelect, punchSignal,
}: Props) {
  const themeColor = useCategoryColor();
  const colorFor = (key: string) =>
    key === LENT_OUT_KEY ? LENT_OUT_COLOR : themeColor(key);

  const expenses = useMemo(
    () => transactions.filter((t) => t.direction === "out"),
    [transactions],
  );
  const spentThisMonth = useMemo(() => totalSpentThisMonth(transactions), [transactions]);

  const breakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of expenses) {
      if (t.items && t.items.length > 0) {
        for (const it of t.items) {
          m.set(it.category, (m.get(it.category) ?? 0) + (it.amount || 0));
        }
      } else {
        m.set(t.category, (m.get(t.category) ?? 0) + t.amount);
      }
    }
    return Array.from(m.entries())
      .map(([key, amount]) => ({ key, amount, cat: getCategory(key) }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses]);

  const total = breakdown.reduce((s, b) => s + b.amount, 0) || 1;

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(320);
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      const nextSize = Math.max(300, Math.round(w * 0.96));
      if (w > 0) setSize(nextSize);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const cx = size / 2, cy = size / 2;
  const rOuter = size * (130 / 280) + 6;
  const rInner = size * (100 / 280) - 3;
  const gap = 2.5;
  // V7: text reduced to ~65% of previous size
  const titleFontPx = Math.round(size * (30 / 280));
  const segTitleFontPx = Math.round(size * (28 / 280));
  const labelFontPx = Math.max(9, Math.round(size * (9 / 280)));
  const microFontPx = Math.max(8, Math.round(size * (8 / 280)));
  const subFontPx = Math.max(10, Math.round(size * (11 / 280)));

  let acc = 0;
  const segments = breakdown.length === 0
    ? []
    : breakdown.map((b) => {
        const slice = (b.amount / total) * 360;
        const start = acc + gap / 2;
        const end = acc + slice - gap / 2;
        acc += slice;
        return { key: b.key, color: colorFor(b.key), start, end, amount: b.amount, cat: b.cat };
      });

  const selectedSeg = segments.find((s) => s.key === selected) ?? null;
  const [expandedKey, setExpandedKey] = useState<string | null>(selected);
  const selectionGrowth = useSpring(0, { stiffness: 200, damping: 20 });
  const [growth, setGrowth] = useState(0);

  useEffect(() => {
    if (selected) setExpandedKey(selected);
    selectionGrowth.set(selected ? 3 : 0);
  }, [selected, selectionGrowth]);
  useEffect(() => selectionGrowth.on("change", setGrowth), [selectionGrowth]);
  const [animateIntro] = useState(() => {
    if (hasPlayedIntroThisSession) return false;
    hasPlayedIntroThisSession = true;
    return true;
  });

  const selectedTxCount = useMemo(() => {
    if (!selected) return 0;
    const now = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    return expenses.filter((t) => {
      if (new Date(t.timestamp).getTime() < mStart) return false;
      if (t.category === selected) return true;
      return t.items?.some((it) => it.category === selected) ?? false;
    }).length;
  }, [expenses, selected]);

  const [punch, setPunch] = useState(false);
  useEffect(() => {
    if (punchSignal == null) return;
    setPunch(true);
    const t = setTimeout(() => setPunch(false), 350);
    return () => clearTimeout(t);
  }, [punchSignal]);

  return (
    <div ref={wrapRef} className="relative w-full" style={{ height: size }} data-tutorial="donut">
      <motion.svg
        width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        style={{ display: "block", margin: "0 auto" }}
        animate={{ scale: punch ? 1.07 : 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 14 }}
      >
        <defs>
          <pattern id="lent-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={LENT_OUT_COLOR} />
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(0,0,0,0.45)" strokeWidth="2" />
          </pattern>
          <linearGradient id="seg-sheen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.18)" />
          </linearGradient>
        </defs>

        {breakdown.length === 0 ? (
          <circle cx={cx} cy={cy} r={(rOuter + rInner) / 2}
            stroke="rgba(255,255,255,0.08)" strokeWidth={rOuter - rInner} fill="none" />
        ) : (
          segments.map((s) => {
            const isSelected = selected === s.key;
            const isExpanded = expandedKey === s.key;
            const dimmed = selected && !isSelected;
            const r1 = isExpanded ? rOuter + growth : rOuter;
            const r2 = isExpanded ? rInner - growth / 2 : rInner;
            const d = arcPath(cx, cy, r1, r2, s.start, s.end);
            const fill = s.key === LENT_OUT_KEY ? "url(#lent-hatch)" : s.color;
            return (
              <g key={s.key}
                 onClick={() => { haptic("medium"); onSelect(isSelected ? null : s.key); }}
                 style={{ cursor: "pointer" }}>
                <motion.path
                  d={d}
                  fill={fill}
                  initial={false}
                  animate={{ opacity: dimmed ? 0.18 : 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                />
                <path d={d} fill="url(#seg-sheen)" pointerEvents="none" opacity={dimmed ? 0.1 : 0.6} />
              </g>
            );
          })
        )}
      </motion.svg>

      <div
        className="pointer-events-none absolute top-0 left-1/2 box-border flex -translate-x-1/2 flex-col items-center justify-center px-6 text-center"
        style={{ width: size, height: size }}
      >
        {selectedSeg ? (
          <p className="uppercase tracking-[0.3em]" style={{ color: selectedSeg.color, fontSize: microFontPx }}>
            {selectedSeg.cat.label}
          </p>
        ) : (
          <p className="uppercase tracking-[0.3em] text-muted-foreground" style={{ fontSize: microFontPx }}>
            Spent this month
          </p>
        )}
        <motion.div
          className="font-mono-display font-light leading-none"
          style={{ color: selectedSeg?.color, fontSize: selectedSeg ? segTitleFontPx : titleFontPx }}
        >
          <AnimatedNumber
            value={selectedSeg?.amount ?? spentThisMonth}
            initialValue={animateIntro ? 0 : selectedSeg?.amount ?? spentThisMonth}
          />
        </motion.div>
      </div>
    </div>
  );
}
