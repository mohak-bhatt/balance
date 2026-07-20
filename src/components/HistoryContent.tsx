import { useCallback, useEffect, useMemo, useState } from "react";
import { TransactionList } from "@/components/TransactionList";
import { EditTransactionPopup } from "@/components/EditTransactionPopup";
import {
  DEFAULT_STATE,
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

  const filtered = useMemo(() => {
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

  return (
    <div
      className="relative mx-auto min-h-screen w-full max-w-md px-5 pb-32"
      style={{ paddingTop: 52 }}
    >
      <div className="relative z-30 flex flex-col items-center text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">History</p>
        <p className="font-mono-display text-base text-foreground/90">
          {state.transactions.length} entries
        </p>
      </div>

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
        {filtered.length === 0 ? (
          <p className="mt-16 text-center text-sm text-muted-foreground">
            No transactions match this filter.
          </p>
        ) : (
          <TransactionList
            transactions={filtered}
            onDelete={deleteTx}
            onEdit={(tx) => setEditTx(tx)}
            onRepayLend={repayLend}
          />
        )}
      </div>
      <EditTransactionPopup
        open={!!editTx}
        tx={editTx}
        onClose={() => setEditTx(null)}
        onSave={saveEdit}
      />
    </div>
  );
}
