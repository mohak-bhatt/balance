import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, Delete, X, Check, FileText, Handshake, ChevronRight,
} from "lucide-react";
import { Icon } from "./Icon";
import { GROUPS, groupFor } from "./CategoryPicker";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { useOverlayState } from "@/lib/OverlayContext";
import {
  LENT_OUT_KEY,
  PAYMENT_METHODS,
  PICKABLE_EXPENSE_CATEGORIES,
  PICKABLE_INCOME_CATEGORIES,
  formatCurrency,
  matchCategory,
  type CategoryDef,
  type Direction,
  type LineItem,
  type PaymentMethod,
  type Transaction,
} from "@/lib/ledger";
import { useCategoryColor } from "@/lib/themes";
import { haptic } from "@/lib/haptics";
import { YellowArrowButton } from "./YellowArrow";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (tx: Omit<Transaction, "id" | "timestamp"> & { timestamp?: string; id?: string }) => void;
  direction: Direction;
  editing?: Transaction | null;
  prefill?: {
    title?: string;
    category?: string;
    icon?: string;
    paymentMethod?: PaymentMethod;
    step?: number;
    singleStep?: boolean;
  } | null;
  currentBalance: number;
  overrides: Record<string, string>;
  onLearnCategory: (text: string, key: string) => void;
  sheetTopPx?: number;
}

const SPRING = { type: "spring" as const, stiffness: 220, damping: 28, mass: 0.9 };
const DEFAULT_SHEET_TOP_PX = 96;

type Mode = "normal" | "lend" | "items";

function getStartingStep(editing: Transaction | null | undefined, prefill: Props["prefill"]): 1 | 2 | 3 {
  if (editing) return editing.lentTo ? 3 : 2;
  const requestedStep = prefill?.step;
  return requestedStep === 2 || requestedStep === 3 ? requestedStep : 1;
}

/** Bottom-sheet popup for picking a category by icon, grouped like the icon picker. */
function CategoryIconPopup({
  open, categories, selectedKey, colorFor, onSelect, onClose,
}: {
  open: boolean;
  categories: CategoryDef[];
  selectedKey: string;
  colorFor: (key: string) => string;
  onSelect: (category: CategoryDef) => void;
  onClose: () => void;
}) {
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
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="fixed inset-x-0 bottom-0 z-[61] max-h-[80vh] overflow-x-hidden overflow-y-auto rounded-t-[28px] border-t border-white/10 p-4"
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

export function AddTransactionModal({
  open, onClose, onSave, direction, editing, prefill, currentBalance,
  overrides, onLearnCategory, sheetTopPx,
}: Props) {
  useOverlayState(open, onClose);
  const SHEET_TOP_PX = Math.max(88, sheetTopPx ?? DEFAULT_SHEET_TOP_PX);
  const isIncome = direction === "in";
  const requestedStep = getStartingStep(editing, prefill);
  const [step, setStep] = useState<1 | 2 | 3>(() => requestedStep);
  const openInstanceRef = useRef(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const lentToInputRef = useRef<HTMLInputElement>(null);
  const editingTitleInputRef = useRef<HTMLInputElement>(null);
  const editingNoteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<Mode>("normal");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [lentTo, setLentTo] = useState("");
  const [items] = useState<LineItem[]>([]);
  const [itemsHaveAmounts] = useState(false);
  const [category, setCategory] = useState(
    isIncome ? PICKABLE_INCOME_CATEGORIES[0].key : PICKABLE_EXPENSE_CATEGORIES[0].key,
  );
  const [icon, setIcon] = useState(
    isIncome ? PICKABLE_INCOME_CATEGORIES[0].icon : PICKABLE_EXPENSE_CATEGORIES[0].icon,
  );
  const [autoCat, setAutoCat] = useState(true);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [singleStep, setSingleStep] = useState(false);
  const [catPopupOpen, setCatPopupOpen] = useState(false);
  const themeColor = useCategoryColor();

  // Step-2 inline editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNote, setEditingNote] = useState(false);

  // Keep skipped steps from mounting during the open-state reset.
  const currentStep = open && !openInstanceRef.current ? requestedStep : step;

  const kb = useKeyboardOffset();
  useBodyScrollLock(open);


  // Reset on open/close
  useEffect(() => {
    if (!open) {
      openInstanceRef.current = false;
      setStep(1); setMode("normal"); setTitle(""); setNote(""); setNoteOpen(false);
      setLentTo("");
      const initialCat = isIncome ? PICKABLE_INCOME_CATEGORIES[0] : PICKABLE_EXPENSE_CATEGORIES[0];
      setCategory(initialCat.key); setIcon(initialCat.icon);
      setAutoCat(true); setAmount(""); setPaymentMethod("cash");
      setSingleStep(false);
      setEditingTitle(false); setEditingNote(false);
      setCatPopupOpen(false);
      return;
    }
    openInstanceRef.current = true;
    setStep(requestedStep);
    if (editing) {
      setTitle(editing.title);
      setNote(editing.note ?? "");
      setNoteOpen(!!editing.note);
      setCategory(editing.category);
      setIcon(editing.icon);
      setAmount(String(editing.amount));
      setPaymentMethod(editing.paymentMethod);
      setAutoCat(false);
      if (editing.lentTo) { setMode("lend"); setLentTo(editing.lentTo); }
      else if (editing.items && editing.items.length > 0) { setMode("items"); }
      setStep(editing.lentTo ? 3 : 2);
    } else if (prefill) {
      if (prefill.title) setTitle(prefill.title);
      if (prefill.category) { setCategory(prefill.category); setAutoCat(false); }
      if (prefill.icon) setIcon(prefill.icon);
      if (prefill.paymentMethod) setPaymentMethod(prefill.paymentMethod);
      if (prefill.step) setStep(prefill.step as 1 | 2 | 3);
      if (prefill.singleStep) setSingleStep(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const input = currentStep === 1
      ? titleInputRef.current
      : currentStep === 2 && mode === "lend"
        ? lentToInputRef.current
        : null;
    if (!input) return;
    const focusTimer = window.setTimeout(() => input.focus(), 350);
    return () => window.clearTimeout(focusTimer);
  }, [open, currentStep, mode]);

  useEffect(() => {
    if (!open || !editingTitle) return;
    const focusTimer = window.setTimeout(() => editingTitleInputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open, editingTitle]);

  useEffect(() => {
    if (!open || !editingNote) return;
    const focusTimer = window.setTimeout(() => editingNoteTextareaRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open, editingNote]);

  // Auto-category from description
  const matched = useMemo(
    () => matchCategory(title, { overrides, direction }),
    [title, overrides, direction],
  );
  useEffect(() => {
    if (!autoCat || !title.trim()) {
      return;
    }
    setCategory(matched.key);
    setIcon(matched.icon);
  }, [matched, autoCat, title]);

  const stepsTotal = mode === "lend" ? 3 : 2;
  const finalStep = stepsTotal;

  const amountForReview = parseFloat(amount || "0");

  const pressKey = (k: string) => {
    haptic("tick");
    if (k === "back") setAmount((a) => a.slice(0, -1));
    else if (k === ".") {
      if (!amount.includes(".")) setAmount((a) => (a === "" ? "0." : a + "."));
    } else setAmount((a) => (a === "0" ? k : a + k));
  };

  const canAdvance = (() => {
    if (currentStep === 1) return title.trim().length > 0;
    if (currentStep === 2 && mode === "lend") return lentTo.trim().length > 0;
    return true;
  })();

  const next = () => {
    if (!canAdvance) return;
    haptic("tick");
    setStep((s) => (s + 1) as 1 | 2 | 3);
  };
  const back = () => { haptic("tick"); setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3); };

  const finalAmount = amountForReview;
  const canSave =
    finalAmount > 0 &&
    title.trim().length > 0 &&
    (mode !== "lend" || lentTo.trim().length > 0);

  const overdraft = !isIncome
    ? Math.max(
        0,
        finalAmount -
          (currentBalance + (editing && editing.direction === "out" ? editing.amount : 0)),
      )
    : 0;
  const alreadyNegative = currentBalance < 0;

  const commit = () => {
    if (!canSave) return;
    const amt = finalAmount;
    if (!autoCat && title.trim() && mode !== "lend") {
      onLearnCategory(title, category);
    }
    const finalCategory = mode === "lend" ? LENT_OUT_KEY : category;
    const finalIcon = mode === "lend" ? "Handshake" : icon;
    const finalItems: LineItem[] | null = mode === "items" ? items : null;

    onSave({
      id: editing?.id,
      timestamp: editing?.timestamp,
      title: title.trim(),
      note: note.trim() || null,
      amount: amt,
      category: finalCategory,
      icon: finalIcon,
      direction,
      paymentMethod,
      lentTo: mode === "lend" ? lentTo.trim() : null,
      repaid: editing?.repaid ?? (mode === "lend" ? false : null),
      items: finalItems,
      sourceLoopId: editing?.sourceLoopId ?? null,
    });
    haptic("success");
    onClose();
  };

  const accent = isIncome ? "#10B981" : "#F87171";
  const sign = isIncome ? "+" : "−";
  const catPool = isIncome ? PICKABLE_INCOME_CATEGORIES : PICKABLE_EXPENSE_CATEGORIES;
  const selectedCategoryColor = themeColor(category);

  const node = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-transparent"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] w-full max-w-md overflow-hidden overflow-x-hidden overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-black"
            style={{ top: SHEET_TOP_PX, bottom: 0 }}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32, mass: 0.9 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.25 }}
            dragMomentum={false}
            onDragEnd={(event, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
          >
            {/* Grey drag handle */}
            <div className="flex justify-center pt-3">
              <div className="h-1.5 w-12 rounded-full bg-white/20" />
            </div>
            <button
              onClick={onClose}
              className="absolute right-4 top-3 z-10 rounded-full p-2 text-muted-foreground"
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.5} />
            </button>
            {((currentStep === 2 && mode === "lend") || (currentStep === finalStep && !singleStep)) && (
              <button
                onClick={back}
                className="absolute left-4 top-3 z-10 rounded-full p-2 text-muted-foreground"
                aria-label="Back"
              >
                <ArrowLeft size={20} strokeWidth={1.5} />
              </button>
            )}

            <div className="relative h-[calc(100%-1.25rem)] w-full">
              <AnimatePresence initial={false}>
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ x: "-100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "-100%", opacity: 0 }}
                    transition={SPRING}
                    className="absolute inset-0 mx-auto flex max-w-md flex-col px-6 pt-6"
                  >
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      Step 1 of {stepsTotal} · {isIncome ? "Income" : "Expense"}
                    </p>
                    <h2 className="mt-3 text-2xl font-light leading-tight">
                      What's this for?
                    </h2>
                    <input
                      ref={titleInputRef}
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); setAutoCat(true); }}
                      placeholder={isIncome ? "e.g. Pocket money from mom" : "e.g. Cafeteria samosa"}
                      onKeyDown={(e) => { if (e.key === "Enter") next(); }}
                      className="editor-field mt-6 w-full text-2xl font-light placeholder:text-muted-foreground/40 focus:border-white/40"
                    />

                    {/* Two modifier buttons */}
                    <div className="mt-5 flex gap-2">
                      <button
                        onClick={() => setNoteOpen((v) => !v)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs ${
                          noteOpen ? "border-white/30 text-foreground" : "border-white/10 text-muted-foreground"
                        }`}
                      >
                        <FileText size={13} strokeWidth={1.6} />
                        Add a note
                      </button>
                      {!isIncome && (
                        <button
                          onClick={() => setMode((m) => (m === "lend" ? "normal" : "lend"))}
                          className={`flex flex-1 items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs ${
                            mode === "lend" ? "border-amber-400/50 text-amber-300" : "border-white/10 text-muted-foreground"
                          }`}
                        >
                          <Handshake size={13} strokeWidth={1.6} />
                          I lent this to someone
                        </button>
                      )}
                    </div>

                    {noteOpen && (
                      <textarea
                        value={note}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                        placeholder="Optional notes…"
                        className="mt-2 h-[3.75rem] w-full resize-none rounded-2xl border border-white/10 bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground/40"
                        rows={2}
                      />
                    )}

                    <div className="flex-1" />

                    <div
                      className="pb-5"
                      style={{ paddingBottom: kb ? kb + 12 : 20 }}
                    >
                      <YellowArrowButton onClick={next} disabled={!canAdvance} />
                    </div>
                  </motion.div>
                )}

                {currentStep === 2 && mode === "lend" && (
                  <motion.div
                    key="step2-lend"
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    transition={SPRING}
                    className="absolute inset-0 mx-auto flex max-w-md flex-col px-6 pt-14"
                  >
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      Step 2 of 3 · Lend
                    </p>
                    <h2 className="mt-3 text-2xl font-light leading-tight">Who's this for?</h2>
                    <input
                      ref={lentToInputRef}
                      value={lentTo}
                      onChange={(e) => setLentTo(e.target.value)}
                      placeholder="e.g. Rohan"
                      onKeyDown={(e) => { if (e.key === "Enter") next(); }}
                      className="mt-6 w-full border-b border-white/15 bg-transparent pb-3 text-2xl font-light outline-none placeholder:text-muted-foreground/40"
                    />
                    <div className="flex-1" />
                    <div
                      className="pb-5"
                      style={{ paddingBottom: kb ? kb + 12 : 20 }}
                    >
                      <YellowArrowButton onClick={next} disabled={!canAdvance} />
                    </div>
                  </motion.div>
                )}

                {currentStep === finalStep && (
                  <motion.div
                    key="step-final"
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    transition={SPRING}
                    className="absolute inset-0 mx-auto flex max-w-md flex-col px-6 pt-14 pb-5"
                  >

                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        {singleStep ? (
                          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                            Add money · {PAYMENT_METHODS.find((m) => m.key === paymentMethod)?.label}
                          </p>
                        ) : (
                          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                            {mode === "lend" ? "Lend" : (isIncome ? "Income" : "Expense")}
                          </p>
                        )}

                        {/* Title (mode !== lend, both singleStep and normal) */}
                        {mode !== "lend" && (
                          editingTitle ? (
                            <input
                              ref={editingTitleInputRef}
                              value={title}
                              onChange={(e) => { setTitle(e.target.value); setAutoCat(true); }}
                              onBlur={() => setEditingTitle(false)}
                              onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
                              className="mt-0.5 w-full bg-transparent text-2xl font-semibold outline-none border-b border-white/20"
                            />
                          ) : (
                            <button
                              onClick={() => setEditingTitle(true)}
                              className="mt-0.5 block w-full truncate text-left text-2xl font-semibold"
                            >
                              {title || "Untitled"}
                            </button>
                          )
                        )}

                        {/* Lend title (no category) */}
                        {mode === "lend" && !singleStep && (
                          <p className="mt-0.5 block w-full truncate text-left text-2xl font-semibold">
                            {`Lent to ${lentTo}`}
                          </p>
                        )}
                      </div>

                      {mode !== "lend" && (
                        <button
                          onClick={() => setCatPopupOpen(true)}
                          className="grid h-14 w-14 shrink-0 place-items-center rounded-full border"
                          style={{
                            borderColor: `${selectedCategoryColor}88`,
                            background: `color-mix(in oklab, ${selectedCategoryColor} 16%, transparent)`,
                            color: selectedCategoryColor,
                          }}
                          aria-label="Change category"
                        >
                          <Icon name={icon} size={22} strokeWidth={1.6} />
                        </button>
                      )}
                    </div>


                    {/* Editable note (preserves line breaks, no wrap) */}
                    {!singleStep && note && !editingNote && (
                      <button
                        onClick={() => setEditingNote(true)}
                        className="mt-2 block w-full overflow-x-auto whitespace-pre text-left text-xs text-muted-foreground"
                      >
                        {note}
                      </button>
                    )}
                    {!singleStep && editingNote && (
                      <textarea
                        ref={editingNoteTextareaRef}
                        value={note}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                        onBlur={() => setEditingNote(false)}
                        rows={3}
                        className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-transparent p-2 text-xs outline-none"
                      />
                    )}

                    {/* Amount display — centered as one unified block */}
                    <div className="mt-4 flex min-h-[4.5rem] items-baseline justify-center text-center">
                      <span className="inline-flex items-baseline gap-1.5">
                        <span
                          className="font-mono-display text-3xl"
                          style={{ color: accent }}
                        >{sign}</span>
                        <span className="font-mono-display text-3xl text-muted-foreground">₹</span>
                        <span className="text-center font-mono-display text-6xl font-light leading-none tabular-nums">
                          {amount || "0"}
                        </span>
                      </span>
                    </div>

                    {/* Overdraft warning */}
                    <div className="mt-2 flex min-h-[2rem] items-center justify-center text-center text-[11px]">
                      {overdraft > 0 && (
                        <p className="text-amber-300/90">
                          Heads up — this will put you {formatCurrency(overdraft)} in the red.
                        </p>
                      )}
                      {overdraft === 0 && alreadyNegative && !isIncome && finalAmount > 0 && (
                        <p className="text-rose-400/90">
                          You're already {formatCurrency(Math.abs(currentBalance))} in the red — this adds to it.
                        </p>
                      )}
                    </div>

                    {/* Add-a-note row (singleStep) — moved above payment methods */}
                    {singleStep && (
                      <div className="mt-3 space-y-2">
                        <button
                          onClick={() => setNoteOpen((v) => !v)}
                          className={`flex w-full items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs ${
                            noteOpen ? "border-white/30 text-foreground" : "border-white/10 text-muted-foreground"
                          }`}
                        >
                          <FileText size={13} strokeWidth={1.6} />
                          Add a note
                        </button>
                        {noteOpen && (
                          <textarea
                            value={note}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                            placeholder="Optional notes…"
                            className="h-[3.75rem] w-full resize-none rounded-2xl border border-white/10 bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground/40"
                            rows={2}
                          />
                        )}
                      </div>
                    )}

                    {/* Payment method chips — exactly 5 equal columns, always one line */}
                    <div className="mt-3 grid grid-cols-5 gap-1.5 px-3">
                      {PAYMENT_METHODS.map((m) => {
                        const sel = paymentMethod === m.key;
                        return (
                          <button
                            key={m.key}
                            onClick={() => { setPaymentMethod(m.key); haptic("tick"); }}
                            className={`flex h-14 w-full flex-col items-center justify-center gap-1 rounded-2xl border px-1 text-center text-[9px] leading-tight ${
                              sel ? "border-white/40 text-foreground" : "border-white/10 text-muted-foreground"
                            }`}
                          >
                            <Icon name={m.icon} size={14} strokeWidth={1.6} />
                            <span className="truncate">{m.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Keypad — fills available vertical space, 4×3 even grid */}
                    <div
                      className="mt-3 grid w-full"
                      style={{
                        flex: 1,
                        minHeight: 0,
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gridTemplateRows: "repeat(4, 1fr)",
                      }}
                    >
                      {["1","2","3","4","5","6","7","8","9",".","0","back"].map((k) => (
                        <motion.button
                          key={k}
                          whileTap={{ scale: 0.85 }}
                          transition={{ type: "spring", stiffness: 500, damping: 16 }}
                          onClick={() => pressKey(k)}
                          className="font-mono-display flex h-full w-full items-center justify-center text-2xl font-light text-foreground/90"
                        >
                          {k === "back" ? <Delete size={18} strokeWidth={1.5} /> : k}
                        </motion.button>
                      ))}
                    </div>

                    <div
                      className="mt-4"
                      style={{ paddingBottom: kb ? kb : 0 }}
                    >
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={commit}
                        disabled={!canSave}
                        className="flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-30"
                        style={{ background: isIncome ? "#16A34A" : "#EF4444" }}
                      >
                        {editing ? "Save changes" : isIncome ? "Add money" : "Log expense"}
                      </motion.button>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          <CategoryIconPopup
            open={catPopupOpen}
            categories={catPool}
            selectedKey={category}
            colorFor={themeColor}
            onSelect={(selected) => {
              setAutoCat(false); setCategory(selected.key); setIcon(selected.icon);
            }}
            onClose={() => setCatPopupOpen(false)}
          />
        </>
      )}
    </AnimatePresence>
  );
  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}