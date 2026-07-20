import { Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { User } from "lucide-react";
import { Tutorial } from "@/components/Tutorial";
import { useCallback, useEffect, useRef, useState } from "react";
import { DonutHero } from "@/components/DonutHero";
import { FavoritesRow } from "@/components/FavoritesRow";
import { FavoriteEditor } from "@/components/FavoriteEditor";
import { LoopsRow } from "@/components/LoopsRow";
import { LoopEditor } from "@/components/LoopEditor";
import { AddTransactionModal } from "@/components/AddTransactionModal";
import { PaymentMethodPopover } from "@/components/PaymentMethodPopover";
import { FavoritePaymentPopup } from "@/components/FavoritePaymentPopup";
import { EditTransactionPopup } from "@/components/EditTransactionPopup";
import { CategoryAnalyticsCard } from "@/components/CategoryAnalyticsCard";
import { useAvatar } from "@/lib/avatar";
import { haptic } from "@/lib/haptics";
import { showUndo } from "@/lib/undo";
import {
  DEFAULT_STATE,
  currentBalance,
  dueLoopExecutions,
  formatCurrency,
  getCategory,
  loadState,
  rememberCategoryChoice,
  saveState,
  type BalanceState,
  type Direction,
  type Favorite,
  type Loop,
  type PaymentMethod,
  type Transaction,
} from "@/lib/ledger";

const SPRING = { type: "spring" as const, stiffness: 260, damping: 26, mass: 0.85 };
const DEFAULT_SHEET_TOP_PX = 96;

function applyTransactionDelta(s: BalanceState, tx: Transaction, sign: 1 | -1): BalanceState {
  const m = { ...s.balancesByMethod };
  const delta = (tx.direction === "in" ? 1 : -1) * sign * tx.amount;
  m[tx.paymentMethod] = (m[tx.paymentMethod] ?? 0) + delta;
  return { ...s, balancesByMethod: m };
}

export function HomeContent() {
  const navigate = useNavigate();
  const [state, setState] = useState<BalanceState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  const [direction, setDirection] = useState<Direction>("out");
  const [modalOpen, setModalOpen] = useState(false);
  const [favEditorOpen, setFavEditorOpen] = useState(false);
  const [loopEditorOpen, setLoopEditorOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  const [editing, setEditing] = useState<Transaction | null>(null);
  const [prefill, setPrefill] = useState<{
    title?: string; category?: string; icon?: string;
    paymentMethod?: PaymentMethod; step?: number; singleStep?: boolean;
  } | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [punch, setPunch] = useState(0);
  const [favPickFor, setFavPickFor] = useState<Favorite | null>(null);
  const [editPopupTx, setEditPopupTx] = useState<Transaction | null>(null);
  const [sheetTopPx, setSheetTopPx] = useState<number>(DEFAULT_SHEET_TOP_PX);
  const topBarRef = useRef<HTMLDivElement>(null);
  const avatar = useAvatar();

  useEffect(() => {
    const s = loadState();
    if (!s.onboardingComplete) { navigate({ to: "/onboarding" }); return; }
    setState(s); setHydrated(true);
  }, [navigate]);
  useEffect(() => { if (hydrated) saveState(state); }, [state, hydrated]);

  const loopsRan = useRef(false);
  useEffect(() => {
    if (!hydrated || loopsRan.current) return;
    loopsRan.current = true;
    setState((s) => {
      let next = s;
      const now = new Date();
      const updatedLoops: Loop[] = s.loops.map((loop) => {
        const due = dueLoopExecutions(loop, now);
        if (due.length === 0) return loop;
        for (const ts of due) {
          const tx: Transaction = {
            id: crypto.randomUUID(),
            title: loop.label,
            note: null,
            amount: loop.amount,
            category: loop.category,
            icon: loop.icon,
            direction: loop.direction,
            paymentMethod: loop.paymentMethod,
            timestamp: ts,
            sourceLoopId: loop.id,
          };
          next = applyTransactionDelta(next, tx, 1);
          next = { ...next, transactions: [tx, ...next.transactions] };
        }
        return { ...loop, lastAppliedDate: due[due.length - 1] };
      });
      return { ...next, loops: updatedLoops };
    });
  }, [hydrated]);

  const balance = currentBalance(state);

  const saveTransaction = useCallback(
    (tx: Omit<Transaction, "id" | "timestamp"> & { id?: string; timestamp?: string }) => {
      setState((s) => {
        let next = s;
        if (tx.id) {
          const old = s.transactions.find((t) => t.id === tx.id);
          if (old) next = applyTransactionDelta(next, old, -1);
          const updated: Transaction = {
            ...(old ?? ({} as Transaction)),
            ...tx,
            id: tx.id,
            timestamp: tx.timestamp ?? old?.timestamp ?? new Date().toISOString(),
          } as Transaction;
          next = applyTransactionDelta(next, updated, 1);
          next = {
            ...next,
            transactions: next.transactions.map((t) => (t.id === tx.id ? updated : t)),
          };
        } else {
          const full: Transaction = {
            ...(tx as Omit<Transaction, "id" | "timestamp">),
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
          };
          next = applyTransactionDelta(next, full, 1);
          next = { ...next, transactions: [full, ...next.transactions] };
        }
        return next;
      });
      setPunch((p) => p + 1);
    },
    [],
  );

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
    setPunch((p) => p + 1);
  }, []);
  void repayLend;

  const onLearnCategory = useCallback((text: string, key: string) => {
    setState((s) => ({
      ...s,
      categorizationOverrides: rememberCategoryChoice(s.categorizationOverrides, text, key),
    }));
  }, []);

  const recalcSheetTop = useCallback(() => {
    const r = topBarRef.current?.getBoundingClientRect();
    if (r) setSheetTopPx(Math.max(88, Math.round(r.bottom + 12)));
  }, []);

  const handleAddExpense = useCallback(() => {
    setDirection("out");
    setEditing(null);
    setPrefill(null);
    haptic("tick");
    const scroller = document.scrollingElement as HTMLElement | null;
    try { scroller?.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* */ }
    setTimeout(() => {
      recalcSheetTop();
      setModalOpen(true);
    }, 320);
  }, [recalcSheetTop]);

  useEffect(() => {
    const onAdd = () => handleAddExpense();
    window.addEventListener("balance:add", onAdd);
    return () => window.removeEventListener("balance:add", onAdd);
  }, [handleAddExpense]);

  const logFavorite = useCallback((f: Favorite, pm: PaymentMethod) => {
    const dir: Direction = f.direction ?? "out";
    if (f.presetAmount != null) {
      const cat = getCategory(f.category);
      saveTransaction({
        title: f.label,
        note: null,
        amount: f.presetAmount,
        category: f.category,
        icon: f.icon || cat.icon,
        direction: dir,
        paymentMethod: pm,
      });
    } else {
      setDirection(dir);
      setEditing(null);
      setPrefill({ title: f.label, category: f.category, icon: f.icon, paymentMethod: pm, step: 2 });
      recalcSheetTop();
      setModalOpen(true);
    }
  }, [saveTransaction, recalcSheetTop]);

  const useFavorite = useCallback((f: Favorite) => {
    if (f.presetAmount == null) {
      const dir: Direction = f.direction ?? "out";
      setDirection(dir);
      setEditing(null);
      setPrefill({
        title: f.label,
        category: f.category,
        icon: f.icon,
        paymentMethod: f.paymentMethod,
        step: 2,
      });
      recalcSheetTop();
      setModalOpen(true);
      return;
    }
    if (f.paymentMethod) logFavorite(f, f.paymentMethod);
    else setFavPickFor(f);
  }, [logFavorite, recalcSheetTop]);

  const addFavorite = useCallback((f: Omit<Favorite, "id">) => {
    setState((s) => ({ ...s, favorites: [...s.favorites, { ...f, id: crypto.randomUUID() }] }));
  }, []);
  const updateFavorite = useCallback((id: string, f: Omit<Favorite, "id">) => {
    setState((s) => ({
      ...s,
      favorites: s.favorites.map((x) => (x.id === id ? { ...f, id } : x)),
    }));
  }, []);
  const deleteFavorite = useCallback((id: string) => {
    setState((s) => {
      const idx = s.favorites.findIndex((f) => f.id === id);
      const old = idx >= 0 ? s.favorites[idx] : undefined;
      if (!old) return s;
      showUndo("Favourite removed", () => {
        setState((cur) => {
          if (cur.favorites.some((f) => f.id === old.id)) return cur;
          const arr = [...cur.favorites];
          arr.splice(Math.min(idx, arr.length), 0, old);
          return { ...cur, favorites: arr };
        });
      });
      return { ...s, favorites: s.favorites.filter((f) => f.id !== id) };
    });
  }, []);

  const addLoop = useCallback((l: Omit<Loop, "id" | "lastAppliedDate">) => {
    setState((s) => {
      const loop: Loop = { ...l, id: crypto.randomUUID(), lastAppliedDate: null };
      const due = dueLoopExecutions(loop, new Date());
      let next: BalanceState = { ...s, loops: [...s.loops, loop] };
      if (due.length > 0) {
        for (const ts of due) {
          const tx: Transaction = {
            id: crypto.randomUUID(),
            title: loop.label,
            note: null,
            amount: loop.amount,
            category: loop.category,
            icon: loop.icon,
            direction: loop.direction,
            paymentMethod: loop.paymentMethod,
            timestamp: ts,
            sourceLoopId: loop.id,
          };
          next = applyTransactionDelta(next, tx, 1);
          next = { ...next, transactions: [tx, ...next.transactions] };
        }
        const applied = due[due.length - 1];
        next = {
          ...next,
          loops: next.loops.map((x) => (x.id === loop.id ? { ...x, lastAppliedDate: applied } : x)),
        };
      }
      return next;
    });
  }, []);
  const updateLoop = useCallback((id: string, l: Omit<Loop, "id" | "lastAppliedDate">) => {
    setState((s) => ({
      ...s,
      loops: s.loops.map((x) => (x.id === id ? { ...x, ...l } : x)),
    }));
  }, []);
  const deleteLoop = useCallback((id: string) => {
    setState((s) => {
      const idx = s.loops.findIndex((l) => l.id === id);
      const old = idx >= 0 ? s.loops[idx] : undefined;
      if (!old) return s;
      showUndo("Loop removed", () => {
        setState((cur) => {
          if (cur.loops.some((l) => l.id === old.id)) return cur;
          const arr = [...cur.loops];
          arr.splice(Math.min(idx, arr.length), 0, old);
          return { ...cur, loops: arr };
        });
      });
      return { ...s, loops: s.loops.filter((l) => l.id !== id) };
    });
  }, []);

  const openAddMoney = useCallback((m?: PaymentMethod) => {
    setPopoverOpen(false);
    setDirection("in");
    setEditing(null);
    setPrefill({
      paymentMethod: m,
      step: 2,
      title: "Added money",
      singleStep: true,
    });
    recalcSheetTop();
    setModalOpen(true);
  }, [recalcSheetTop]);

  const handleSelectCat = useCallback((key: string | null) => {
    setSelectedCat(key);
    if (key) haptic("medium");
  }, []);

  const lowBalanceThreshold = state.lowBalanceAlertThreshold ?? 0;

  return (
    <div
      className="relative mx-auto min-h-screen w-full max-w-md px-5 pb-12"
      style={{ paddingTop: 52 }}
    >


      <div ref={topBarRef} className="relative z-30 flex items-center justify-between">
        <button
          onClick={() => setPopoverOpen((v) => !v)}
          className="flex flex-col items-start"
          data-tutorial="balance"
        >
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Balance
          </p>
          <span
            className="font-mono-display text-2xl tabular-nums leading-tight"
            style={{ color: balance < 0 ? "#EF4444" : undefined }}
          >
            {formatCurrency(balance)}
          </span>
        </button>
        <Link
          to="/settings"
          className="grid h-12 w-12 place-items-center overflow-hidden rounded-full border border-white/10 text-foreground/80"
          aria-label="Profile"
        >
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <User size={18} strokeWidth={1.5} />
          )}
        </Link>
      </div>

      <PaymentMethodPopover
        open={popoverOpen}
        onClose={() => setPopoverOpen(false)}
        balances={state.balancesByMethod}
        onAddMoney={openAddMoney}
      />

      <div className="mt-6 -mx-1">
        <DonutHero
          transactions={state.transactions}
          balance={balance}
          lowBalanceThreshold={lowBalanceThreshold}
          selected={selectedCat}
          onSelect={handleSelectCat}
          punchSignal={punch}
        />
      </div>

      <motion.div layout transition={SPRING} className="mt-6 space-y-3">
        <AnimatePresence initial={false} mode="popLayout">
          {selectedCat && (
            <motion.div
              key="cat-analytics"
              layout
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={SPRING}
            >
              <CategoryAnalyticsCard
                categoryKey={selectedCat}
                transactions={state.transactions}
                onClear={() => setSelectedCat(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>


        <motion.div
          layout
          transition={SPRING}
          className="rounded-[20px] border p-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.06)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
          data-tutorial="favorites"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.35)" }}>
              Favourites
            </span>
            <span className="font-mono-display text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.35)" }}>
              {String(state.favorites.length).padStart(2, "0")}
            </span>
          </div>
          <FavoritesRow
            favorites={state.favorites}
            onUse={useFavorite}
            onCreate={() => setFavEditorOpen(true)}
            hideHeader
          />
        </motion.div>

        <motion.div
          layout
          transition={SPRING}
          className="rounded-[20px] border p-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.06)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}
          data-tutorial="loops"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.22em]" style={{ color: "rgba(255,255,255,0.35)" }}>
              Loops
            </span>
            <span className="font-mono-display text-xs tabular-nums" style={{ color: "rgba(255,255,255,0.35)" }}>
              {String(state.loops.length).padStart(2, "0")}
            </span>
          </div>
          <LoopsRow loops={state.loops} onCreate={() => setLoopEditorOpen(true)} hideHeader />
        </motion.div>
      </motion.div>


      <AddTransactionModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setPrefill(null); setEditing(null); }}
        onSave={saveTransaction}
        direction={direction}
        editing={editing}
        prefill={prefill}
        currentBalance={balance}
        overrides={state.categorizationOverrides}
        onLearnCategory={onLearnCategory}
        sheetTopPx={sheetTopPx}
      />

      <FavoriteEditor
        open={favEditorOpen}
        onClose={() => setFavEditorOpen(false)}
        favorites={state.favorites}
        onAdd={addFavorite}
        onUpdate={updateFavorite}
        onDelete={deleteFavorite}
        mode="compact"
      />

      <LoopEditor
        open={loopEditorOpen}
        onClose={() => setLoopEditorOpen(false)}
        loops={state.loops}
        onAdd={addLoop}
        onUpdate={updateLoop}
        onDelete={deleteLoop}
        mode="compact"
      />
      <Tutorial />

      <FavoritePaymentPopup
        open={!!favPickFor}
        onClose={() => setFavPickFor(null)}
        onPick={(m) => {
          const f = favPickFor;
          setFavPickFor(null);
          if (f) logFavorite(f, m);
        }}
      />
      <EditTransactionPopup
        open={!!editPopupTx}
        tx={editPopupTx}
        onClose={() => setEditPopupTx(null)}
        onSave={(updated) => saveTransaction(updated)}
        sheetTopPx={sheetTopPx}
      />
    </div>
  );
}
