import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft, Delete, X, Check, FileText, Handshake,
} from "lucide-react";
import { Icon } from "./Icon";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import {
  LENT_OUT_KEY,
  PAYMENT_METHODS,
  PICKABLE_EXPENSE_CATEGORIES,
  PICKABLE_INCOME_CATEGORIES,
  formatCurrency,
  getCategory,
  matchCategory,
  type Direction,
  type LineItem,
  type PaymentMethod,
  type Transaction,
} from "@/lib/ledger";
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

const SPRING = { type: "spring" as const, stiffness: 260, damping: 26, mass: 0.85 };
const DEFAULT_SHEET_TOP_PX = 96;

type Mode = "normal" | "lend" | "items";

export function AddTransactionModal({
  open, onClose, onSave, direction, editing, prefill, currentBalance,
  overrides, onLearnCategory, sheetTopPx,
}: Props) {
  const SHEET_TOP_PX = Math.max(88, sheetTopPx ?? DEFAULT_SHEET_TOP_PX);
  const isIncome = direction === "in";
  const [step, setStep] = useState(1);
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
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [singleStep, setSingleStep] = useState(false);

  // Step-2 inline editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingNote, setEditingNote] = useState(false);

  const kb = useKeyboardOffset();
  useBodyScrollLock(open);


  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setStep(1); setMode("normal"); setTitle(""); setNote(""); setNoteOpen(false);
      setLentTo("");
      const initialCat = isIncome ? PICKABLE_INCOME_CATEGORIES[0] : PICKABLE_EXPENSE_CATEGORIES[0];
      setCategory(initialCat.key); setIcon(initialCat.icon);
      setAutoCat(true); setAmount(""); setPaymentMethod("cash");
      setCatPickerOpen(false); setSingleStep(false);
      setEditingTitle(false); setEditingNote(false);
      return;
    }
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

  // Auto-category from description
  const matched = useMemo(
    () => matchCategory(title, { overrides, direction }),
    [title, overrides, direction],
  );
  useEffect(() => {
    if (autoCat && title.trim()) {
      setCategory(matched.key);
      setIcon(matched.icon);
    }
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
    if (step === 1) return title.trim().length > 0;
    if (step === 2 && mode === "lend") return lentTo.trim().length > 0;
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
  const cat = getCategory(category);
  const catPool = isIncome ? PICKABLE_INCOME_CATEGORIES : PICKABLE_EXPENSE_CATEGORIES;

  const node = (
    <AnimatePresence>
      {open && (
        <>
          {/* Transparent click-catcher above the sheet (top bar area). No blur, no tint —
              donut and top bar stay sharp & fully visible. */}
          <motion.div
            className="fixed inset-x-0 top-0 z-40"
            style={{ height: SHEET_TOP_PX, background: "transparent" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          {/* Envelope sheet: slides up from FAB, leaves Balance visible */}
          <motion.div
            layoutId="fab"
            className="fixed inset-x-0 z-50 overflow-hidden rounded-t-[28px] border-t border-white/10 bg-black"
            style={{ top: SHEET_TOP_PX, bottom: 0 }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING}
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

            <div className="relative h-[calc(100%-1.25rem)] w-full">
              <AnimatePresence initial={false} mode="popLayout">
                {step === 1 && (
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
                      autoFocus
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); setAutoCat(true); }}
                      placeholder={isIncome ? "e.g. Pocket money from mom" : "e.g. Cafeteria samosa"}
                      onKeyDown={(e) => { if (e.key === "Enter") next(); }}
                      className="mt-6 w-full border-b border-white/15 bg-transparent pb-3 text-2xl font-light outline-none placeholder:text-muted-foreground/40 focus:border-white/40"
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
                      <motion.textarea
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        value={note}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                        placeholder="Optional notes…"
                        className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground/40"
                        rows={2}
                      />
                    )}

                    <div className="flex-1" />

                    <div
                      className="pb-5 transition-[padding] duration-150"
                      style={{ paddingBottom: kb ? kb + 12 : 20 }}
                    >
                      <YellowArrowButton onClick={next} disabled={!canAdvance} />
                    </div>
                  </motion.div>
                )}

                {step === 2 && mode === "lend" && (
                  <motion.div
                    key="step2-lend"
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    transition={SPRING}
                    className="absolute inset-0 mx-auto flex max-w-md flex-col px-6 pt-6"
                  >
                    <button onClick={back} className="self-start rounded-full p-2 text-muted-foreground" aria-label="Back">
                      <ArrowLeft size={20} strokeWidth={1.5} />
                    </button>
                    <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                      Step 2 of 3 · Lend
                    </p>
                    <h2 className="mt-3 text-2xl font-light leading-tight">Who's this for?</h2>
                    <input
                      autoFocus
                      value={lentTo}
                      onChange={(e) => setLentTo(e.target.value)}
                      placeholder="e.g. Rohan"
                      onKeyDown={(e) => { if (e.key === "Enter") next(); }}
                      className="mt-6 w-full border-b border-white/15 bg-transparent pb-3 text-2xl font-light outline-none placeholder:text-muted-foreground/40"
                    />
                    <div className="flex-1" />
                    <div
                      className="pb-5 transition-[padding] duration-150"
                      style={{ paddingBottom: kb ? kb + 12 : 20 }}
                    >
                      <YellowArrowButton onClick={next} disabled={!canAdvance} />
                    </div>
                  </motion.div>
                )}

                {step === finalStep && (
                  <motion.div
                    key="step-final"
                    initial={{ x: "100%", opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: "100%", opacity: 0 }}
                    transition={SPRING}
                    className="absolute inset-0 mx-auto flex max-w-md flex-col px-6 pt-5 pb-5"
                  >
                    {!singleStep ? (
                      <button onClick={back} className="self-start rounded-full p-2 text-muted-foreground" aria-label="Back">
                        <ArrowLeft size={20} strokeWidth={1.5} />
                      </button>
                    ) : (
                      <div className="h-9" />
                    )}

                    {singleStep ? (
                      <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                        Add money · {PAYMENT_METHODS.find((m) => m.key === paymentMethod)?.label}
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                        {mode === "lend" ? "Lend" : (isIncome ? "Income" : "Expense")}
                      </p>
                    )}

                    {/* Editable title */}
                    {!singleStep && (
                      <div className="mt-1">
                        {editingTitle ? (
                          <input
                            autoFocus
                            value={title}
                            onChange={(e) => { setTitle(e.target.value); setAutoCat(true); }}
                            onBlur={() => setEditingTitle(false)}
                            onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
                            className="w-full bg-transparent text-xl font-medium outline-none border-b border-white/20"
                          />
                        ) : (
                          <button
                            onClick={() => setEditingTitle(true)}
                            className="block w-full truncate text-left text-xl font-medium"
                          >
                            {mode === "lend" ? `Lent to ${lentTo}` : (title || "Untitled")}
                          </button>
                        )}
                      </div>
                    )}

                    {/* category chip */}
                    {mode !== "lend" && !singleStep && (
                      <>
                        <button
                          onClick={() => setCatPickerOpen((v) => !v)}
                          className="mt-2 flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs"
                          style={{
                            borderColor: cat.color + "55",
                            background: `color-mix(in oklab, ${cat.color} 14%, transparent)`,
                            color: cat.color,
                          }}
                        >
                          <Icon name={cat.icon} size={12} strokeWidth={1.7} />
                          <span className="font-medium">{cat.label}</span>
                        </button>

                        <AnimatePresence>
                          {catPickerOpen && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="-mx-6 mt-2 overflow-hidden"
                            >
                              <div className="flex gap-1.5 overflow-x-auto px-6 pb-1">
                                {catPool.map((c) => {
                                  const sel = c.key === category;
                                  return (
                                    <button
                                      key={c.key}
                                      onClick={() => {
                                        setAutoCat(false); setCategory(c.key); setIcon(c.icon);
                                        setCatPickerOpen(false);
                                      }}
                                      className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
                                      style={sel ? {
                                        borderColor: c.color,
                                        background: `color-mix(in oklab, ${c.color} 18%, transparent)`,
                                        color: c.color,
                                      } : {
                                        borderColor: "rgba(255,255,255,0.08)",
                                        color: "rgba(255,255,255,0.65)",
                                      }}
                                    >
                                      <Icon name={c.icon} size={12} strokeWidth={1.7} />
                                      <span>{c.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}

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
                        autoFocus
                        value={note}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                        onBlur={() => setEditingNote(false)}
                        rows={3}
                        className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-transparent p-2 text-xs outline-none"
                      />
                    )}

                    {/* Amount display */}
                    <div className="mt-4 flex items-baseline justify-center gap-1.5">
                      <span
                        className="font-mono-display text-3xl"
                        style={{ color: accent }}
                      >{sign}</span>
                      <span className="font-mono-display text-3xl text-muted-foreground">₹</span>
                      <motion.span
                        key={amount || "0"}
                        initial={{ scale: 0.85, opacity: 0, y: 8 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 320, damping: 16 }}
                        className="font-mono-display text-6xl font-light leading-none"
                      >
                        {amount || "0"}
                      </motion.span>
                    </div>

                    {/* Overdraft warning */}
                    {overdraft > 0 && (
                      <p className="mt-2 text-center text-[11px] text-amber-300/90">
                        Heads up — this will put you {formatCurrency(overdraft)} in the red.
                      </p>
                    )}
                    {overdraft === 0 && alreadyNegative && !isIncome && finalAmount > 0 && (
                      <p className="mt-2 text-center text-[11px] text-rose-400/90">
                        You're already {formatCurrency(Math.abs(currentBalance))} in the red — this adds to it.
                      </p>
                    )}

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
                          <motion.textarea
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            value={note}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
                            placeholder="Optional notes…"
                            className="w-full resize-none rounded-2xl border border-white/10 bg-transparent p-3 text-sm outline-none placeholder:text-muted-foreground/40"
                            rows={2}
                          />
                        )}
                      </div>
                    )}

                    {/* Payment method chips */}
                    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                      {PAYMENT_METHODS.map((m) => {
                        const sel = paymentMethod === m.key;
                        return (
                          <button
                            key={m.key}
                            onClick={() => { setPaymentMethod(m.key); haptic("tick"); }}
                            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] ${
                              sel ? "border-white/40 text-foreground" : "border-white/10 text-muted-foreground"
                            }`}
                          >
                            <Icon name={m.icon} size={11} strokeWidth={1.6} />
                            {m.label}
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
                      className="mt-4 transition-[padding] duration-150"
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
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}
