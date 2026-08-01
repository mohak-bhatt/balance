import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { TransactionList } from "@/components/TransactionList";
import { EditTransactionPopup } from "@/components/EditTransactionPopup";
import {
  DEFAULT_STATE,
  formatCurrency,
  loadState,
  saveState,
  type BalanceState,
  type Transaction,
} from "@/lib/ledger";
import { haptic } from "@/lib/haptics";
import { showUndo } from "@/lib/undo";

type Filter =
  | "all"
  | "expenses"
  | "income"
  | "lent"
  | "repaid"
  | "recurring"
  | "cash"
  | "upi"
  | "card"
  | "thisMonth"
  | "lastMonth";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "expenses", label: "Expenses" },
  { key: "income", label: "Income" },
  { key: "lent", label: "Lent Out" },
  { key: "repaid", label: "Repaid" },
  { key: "recurring", label: "Recurring" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "cash", label: "Cash" },
  { key: "upi", label: "UPI" },
  { key: "card", label: "Card" },
];

function applyTransactionDelta(s: BalanceState, tx: Transaction, sign: 1 | -1): BalanceState {
  const m = { ...s.balancesByMethod };
  const delta = (tx.direction === "in" ? 1 : -1) * sign * tx.amount;
  m[tx.paymentMethod] = (m[tx.paymentMethod] ?? 0) + delta;
  return { ...s, balancesByMethod: m };
}

export function HistoryContent() {
  const [state, setState] = useState<BalanceState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isPulling = useRef(false);

  useEffect(() => { setState(loadState()); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) saveState(state); }, [state, hydrated]);

  const saveEdit = useCallback((updated: Transaction) => {
    setState((s) => {
      const old = s.transactions.find((t) => t.id === updated.id);
      if (!old) return s;
      let next = applyTransactionDelta(s, old, -1);
      next = applyTransactionDelta(next, updated, 1);
      next = { ...next, transactions: next.transactions.map((t) => (t.id === updated.id ? updated : t)) };
      return next;
    });
  }, []);

  const deleteTx = useCallback((id: string) => {
    setState((s) => {
      const idx = s.transactions.findIndex((t) => t.id === id);
      const old = idx >= 0 ? s.transactions[idx] : undefined;
      if (!old) return s;
      let next = applyTransactionDelta(s, old, -1);
      next = { ...next, transactions: next.transactions.filter((t) => t.id !== id) };
      showUndo("Transaction deleted", () => {
        setState((cur) => {
          if (cur.transactions.some((t) => t.id === old.id)) return cur;
          let r = applyTransactionDelta(cur, old, 1);
          const arr = [...cur.transactions];
          arr.splice(Math.min(idx, arr.length), 0, old);
          return { ...r, transactions: arr };
        });
      });
      return next;
    });
    haptic("thud");
  }, []);

  const repayLend = useCallback((tx: Transaction) => {
    if (!tx.lentTo || tx.repaid) return;
    const repayment: Transaction = {
      id: crypto.randomUUID(),
      title: `Repayment from ${tx.lentTo}`,
      note: null,
      amount: tx.amount,
      category: "loan_repaid",
      icon: "Handshake",
      direction: "in",
      paymentMethod: tx.paymentMethod,
      timestamp: new Date().toISOString(),
      repaymentOfId: tx.id,
    };
    setState((s) => {
      let next = applyTransactionDelta(s, repayment, 1);
      next = {
        ...next,
        transactions: [
          repayment,
          ...next.transactions.map((t) => (t.id === tx.id ? { ...t, repaid: true } : t)),
        ],
      };
      return next;
    });
    haptic("success");
  }, []);

  const baseFiltered = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    switch (filter) {
      case "expenses": return state.transactions.filter((t) => t.direction === "out" && !t.lentTo);
      case "income": return state.transactions.filter((t) => t.direction === "in");
      case "lent": return state.transactions.filter((t) => t.lentTo != null && !t.repaid);
      case "repaid": return state.transactions.filter((t) => t.repaid || t.repaymentOfId);
      case "recurring": return state.transactions.filter((t) => t.sourceLoopId);
      case "cash": return state.transactions.filter((t) => t.paymentMethod === "cash");
      case "upi": return state.transactions.filter((t) => t.paymentMethod === "upi");
      case "card": return state.transactions.filter((t) => t.paymentMethod === "card");
      case "thisMonth":
        return state.transactions.filter((t) => new Date(t.timestamp).getTime() >= monthStart);
      case "lastMonth":
        return state.transactions.filter((t) => {
          const ts = new Date(t.timestamp).getTime();
          return ts >= lastMonthStart && ts < monthStart;
        });
      default: return state.transactions;
    }
  }, [state.transactions, filter]);

  const filtered = useMemo(() => {
    if (!searchFocused) return baseFiltered;

    const query = search.trim().toLowerCase();
    if (!query) return [];

    return baseFiltered.filter((t) => {
      const timestamp = new Date(t.timestamp);
      const monthLong = new Intl.DateTimeFormat("en-US", { month: "long" }).format(timestamp).toLowerCase();
      const monthShort = new Intl.DateTimeFormat("en-US", { month: "short" }).format(timestamp).toLowerCase();
      const year = timestamp.getFullYear().toString();
      const day = timestamp.getDate().toString();
      const fullDate = timestamp.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toLowerCase();
      const time12 = timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
      const time24 = timestamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).toLowerCase();
      const hourOnly12 = timestamp.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }).toLowerCase();
      const amountPlain = String(t.amount);
      const amountFormatted = formatCurrency(t.amount).toLowerCase();
      const fields = [
        t.title,
        t.note ?? "",
        t.category,
        t.lentTo ?? "",
        monthLong,
        monthShort,
        year,
        day,
        fullDate,
        time12,
        time24,
        hourOnly12,
        amountPlain,
        amountFormatted,
      ]
        .map((value) => value.toLowerCase());

      return fields.some((value) => value.includes(query));
    });
  }, [baseFiltered, searchFocused, search]);

  const matchReasons = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!searchFocused || !query) return undefined;

    const reasons: Record<string, string> = {};
    baseFiltered.forEach((t) => {
      const timestamp = new Date(t.timestamp);
      const monthLong = new Intl.DateTimeFormat("en-US", { month: "long" }).format(timestamp).toLowerCase();
      const monthShort = new Intl.DateTimeFormat("en-US", { month: "short" }).format(timestamp).toLowerCase();
      const year = timestamp.getFullYear().toString();
      const day = timestamp.getDate().toString();
      const fullDate = timestamp.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toLowerCase();
      const time12 = timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toLowerCase();
      const time24 = timestamp.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).toLowerCase();
      const hourOnly12 = timestamp.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }).toLowerCase();

      const amountPlain = String(t.amount);
      const amountFormatted = formatCurrency(t.amount).toLowerCase();
      const candidates = [
        { value: t.title, reason: "Matched in title" },
        { value: t.note ?? "", reason: "Matched in note" },
        { value: t.category, reason: `Matched in category: ${t.category}` },
        { value: t.lentTo ?? "", reason: `Matched lent-to: ${t.lentTo}` },
        { value: amountPlain, reason: `Matched amount: ${formatCurrency(t.amount)}` },
        { value: amountFormatted, reason: `Matched amount: ${formatCurrency(t.amount)}` },
      ];

      const matched = candidates.find((candidate) =>
        candidate.value.toLowerCase().includes(query),
      );
      if (matched) {
        reasons[t.id] = matched.reason;
        return;
      }

      const timeFields = [monthLong, monthShort, year, day, fullDate, time12, time24, hourOnly12];
      if (timeFields.some((value) => value.includes(query))) {
        reasons[t.id] = "Matched date/time";
      }
    });

    return reasons;
  }, [baseFiltered, searchFocused, search]);

  return (
    <div
      className="relative mx-auto min-h-screen w-full max-w-md px-5 pb-32"
      style={{ paddingTop: 52 }}
      onTouchStart={(e) => {
        if (window.scrollY === 0 && !searchFocused) {
          touchStartY.current = e.touches[0].clientY;
          isPulling.current = true;
        }
      }}
      onTouchMove={(e) => {
        if (!isPulling.current || touchStartY.current === null) return;
        const delta = e.touches[0].clientY - touchStartY.current;
        if (delta > 0 && window.scrollY === 0) {
          setPullDistance(Math.min(delta, 80));
        } else {
          isPulling.current = false;
          setPullDistance(0);
        }
      }}
      onTouchEnd={() => {
        if (pullDistance > 40) {
          setSearchFocused(true);
          setTimeout(() => searchInputRef.current?.focus(), 50);
        }
        setPullDistance(0);
        isPulling.current = false;
        touchStartY.current = null;
      }}
    >
      <motion.div
        animate={{
          filter: pullDistance > 0 ? `blur(${Math.min(pullDistance / 8, 6)}px)` : "blur(0px)",
          opacity: pullDistance > 0 ? Math.max(1 - pullDistance / 100, 0.4) : 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative z-30 flex flex-col items-center text-center"
      >
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">History</p>
        <p className="font-mono-display text-base text-foreground/90">
          {searchFocused ? filtered.length : baseFiltered.length} entries
        </p>
      </motion.div>

      <motion.div
        animate={{
          scale: searchFocused ? 1.03 : 1,
          paddingTop: searchFocused ? 14 : 12,
          paddingBottom: searchFocused ? 14 : 12,
          y: pullDistance > 0 ? pullDistance * 0.4 : 0,
          opacity: pullDistance > 0 ? Math.min(0.6 + pullDistance / 80, 1) : 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="rounded-[20px] border mt-4"
        style={{
          background: "rgba(255,255,255,0.03)",
          borderColor: "rgba(255,255,255,0.06)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 12,
          paddingBottom: 12,
        }}
      >
        <div className="flex items-center gap-3 h-5" style={{ lineHeight: "1.25rem" }}>
          <Search size={16} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />
          <input
            ref={searchInputRef}
            type="text"
            className="min-w-0 flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis"
            style={{ lineHeight: "1.25rem" }}
            placeholder="Search transactions"
            value={search}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => {
              if (search.trim() === "") setSearchFocused(false);
            }}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search.trim() !== "" ? (
            <button
              type="button"
              className="shrink-0 grid h-5 w-5 place-items-center rounded-full text-muted-foreground hover:bg-white/10"
              onClick={() => {
                setSearch("");
                setSearchFocused(false);
                searchInputRef.current?.blur();
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          ) : null}
        </div>
      </motion.div>

      <motion.div
        animate={{
          filter: pullDistance > 0 ? `blur(${Math.min(pullDistance / 8, 6)}px)` : "blur(0px)",
          opacity: pullDistance > 0 ? Math.max(1 - pullDistance / 100, 0.4) : 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <div className="hide-scrollbar mt-5 -mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1">
          {FILTERS.map((f) => {
            const sel = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); haptic("tick"); }}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] ${
                  sel
                    ? "border-white/40 text-foreground bg-white/[0.06]"
                    : "border-white/10 text-muted-foreground"
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 h-px w-full bg-white/[0.06]" />

        <div className="mt-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={searchFocused ? "search" : "browse"}
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {filtered.length === 0 ? (
                <p className="mt-16 text-center text-sm text-muted-foreground">
                  {searchFocused
                    ? search.trim() === ""
                      ? "Start typing to search"
                      : "No transactions match your search."
                    : "No transactions."}
                </p>
              ) : (
                <TransactionList
                  transactions={filtered}
                  onDelete={deleteTx}
                  onEdit={(tx) => setEditTx(tx)}
                  onRepayLend={repayLend}
                  matchReasons={matchReasons}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      <EditTransactionPopup
        open={!!editTx}
        tx={editTx}
        onClose={() => setEditTx(null)}
        onSave={saveEdit}
      />
    </div>
  );
}
