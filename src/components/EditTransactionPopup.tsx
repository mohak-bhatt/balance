import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Delete, X } from "lucide-react";
import { Icon } from "./Icon";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import {
  LENT_OUT_KEY,
  PAYMENT_METHODS,
  PICKABLE_EXPENSE_CATEGORIES,
  PICKABLE_INCOME_CATEGORIES,
  getCategory,
  type PaymentMethod,
  type Transaction,
} from "@/lib/ledger";
import { haptic } from "@/lib/haptics";

interface Props {
  open: boolean;
  tx: Transaction | null;
  onClose: () => void;
  onSave: (tx: Transaction) => void;
  sheetTopPx?: number;
}

const SPRING = { type: "spring" as const, stiffness: 260, damping: 26, mass: 0.85 };
const DEFAULT_SHEET_TOP_PX = 96;

export function EditTransactionPopup({ open, tx, onClose, onSave, sheetTopPx }: Props) {
  const SHEET_TOP_PX = Math.max(88, sheetTopPx ?? DEFAULT_SHEET_TOP_PX);
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [editingNote, setEditingNote] = useState(false);
  const [pm, setPm] = useState<PaymentMethod>("cash");
  const [lentTo, setLentTo] = useState("");
  const [editingLentTo, setEditingLentTo] = useState(false);
  const [isLend, setIsLend] = useState(false);
  const [category, setCategory] = useState<string>("misc");
  const [icon, setIcon] = useState<string>("Sparkles");
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const kb = useKeyboardOffset();

  useEffect(() => {
    if (!open || !tx) return;
    setTitle(tx.title);
    setAmount(String(tx.amount));
    setNote(tx.note ?? "");
    setPm(tx.paymentMethod);
    setLentTo(tx.lentTo ?? "");
    setIsLend(!!tx.lentTo);
    setCategory(tx.category);
    setIcon(tx.icon);
    setEditingTitle(false);
    setEditingNote(false);
    setEditingLentTo(false);
    setCatPickerOpen(false);
  }, [open, tx]);

  useBodyScrollLock(open);

  // Hardware back closes
  useEffect(() => {
    if (!open) return;
    try { window.history.pushState({ __editSheet: true }, ""); } catch { /* */ }
    const onPop = () => onClose();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;
  if (!tx) return null;

  const pressKey = (k: string) => {
    haptic("tick");
    if (k === "back") setAmount((a) => (a.length <= 1 ? "0" : a.slice(0, -1)));
    else if (k === ".") {
      if (!amount.includes(".")) setAmount((a) => (a === "" || a === "0" ? "0." : a + "."));
    } else setAmount((a) => (a === "0" || a === "" ? k : a + k));
  };

  const commit = () => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return;
    if (!title.trim()) return;
    if (isLend && !lentTo.trim()) return;
    onSave({
      ...tx,
      title: title.trim(),
      amount: amt,
      note: note.trim() || null,
      paymentMethod: pm,
      lentTo: isLend ? lentTo.trim() : null,
      category: isLend ? LENT_OUT_KEY : category,
      icon: isLend ? "Handshake" : icon,
      repaid: isLend ? (tx.repaid ?? false) : null,
    });
    haptic("success");
    onClose();
  };

  const accent = tx.direction === "in" ? "#10B981" : "#F87171";
  const sign = tx.direction === "in" ? "+" : "−";
  const cat = isLend ? getCategory(LENT_OUT_KEY) : getCategory(category);
  const catPool = tx.direction === "in" ? PICKABLE_INCOME_CATEGORIES : PICKABLE_EXPENSE_CATEGORIES;

  const node = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-x-0 top-0 z-[120]"
            style={{ height: SHEET_TOP_PX, background: "transparent" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-0 z-[130] overflow-hidden rounded-t-[28px] border-t border-white/10 bg-black"
            style={{ top: SHEET_TOP_PX, bottom: 0 }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={SPRING}
          >
            <div className="flex justify-center pt-3">
              <div className="h-1.5 w-12 rounded-full bg-white/20" />
            </div>
            <button
              onClick={onClose}
              className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/[0.06] text-foreground/90"
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.6} />
            </button>

            <div className="mx-auto flex h-[calc(100%-1.25rem)] max-w-md flex-col px-6 pt-4 pb-5">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Edit · {isLend ? "Lend" : (tx.direction === "in" ? "Income" : "Expense")}
              </p>

              {/* Editable title */}
              <div className="mt-1">
                {editingTitle ? (
                  <input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
                    className="w-full border-b border-white/30 bg-transparent text-xl font-medium outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setEditingTitle(true)}
                    className="block w-full truncate text-left text-xl font-medium"
                  >
                    {isLend ? `Lent to ${lentTo || "—"}` : (title || "Untitled")}
                  </button>
                )}
              </div>

              {/* Category chip — opens picker */}
              {!isLend && (
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
                        <div className="hide-scrollbar flex gap-1.5 overflow-x-auto px-6 pb-1">
                          {catPool.map((c) => {
                            const sel = c.key === category;
                            return (
                              <button
                                key={c.key}
                                onClick={() => {
                                  setCategory(c.key); setIcon(c.icon);
                                  setCatPickerOpen(false);
                                  haptic("tick");
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

              {/* Editable note */}
              <div className="mt-3">
                {editingNote ? (
                  <textarea
                    autoFocus
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onBlur={() => setEditingNote(false)}
                    rows={2}
                    className="w-full resize-none rounded-xl border border-white/10 bg-transparent p-2 text-xs outline-none"
                  />
                ) : (
                  <button
                    onClick={() => setEditingNote(true)}
                    className="block w-full overflow-x-auto whitespace-pre text-left text-xs text-muted-foreground"
                  >
                    {note || <span className="text-muted-foreground/60">+ Add note</span>}
                  </button>
                )}
              </div>

              {/* Amount display */}
              <div className="mt-3 flex items-baseline justify-center gap-1.5">
                <span className="font-mono-display text-3xl" style={{ color: accent }}>{sign}</span>
                <span className="font-mono-display text-3xl text-muted-foreground">₹</span>
                <motion.span
                  key={amount || "0"}
                  initial={{ scale: 0.9, opacity: 0, y: 6 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 320, damping: 16 }}
                  className="font-mono-display text-5xl font-light leading-none"
                >
                  {amount || "0"}
                </motion.span>
              </div>

              {/* Lend controls */}
              {(tx.direction === "out" || isLend) && (
                <div className="mt-3">
                  {isLend ? (
                    <div className="space-y-2">
                      {editingLentTo ? (
                        <input
                          autoFocus
                          value={lentTo}
                          onChange={(e) => setLentTo(e.target.value)}
                          onBlur={() => setEditingLentTo(false)}
                          onKeyDown={(e) => { if (e.key === "Enter") setEditingLentTo(false); }}
                          placeholder="Who?"
                          className="w-full border-b border-white/30 bg-transparent pb-1.5 text-sm outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => setEditingLentTo(true)}
                          className="block w-full border-b border-white/15 pb-1.5 text-left text-sm"
                        >
                          {lentTo
                            ? <>Lent to <span className="text-amber-300">{lentTo}</span></>
                            : <span className="text-muted-foreground">Tap to set who you lent it to</span>}
                        </button>
                      )}
                      <button
                        onClick={() => { setIsLend(false); setLentTo(""); }}
                        className="w-full rounded-full border border-amber-400/40 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-amber-300/90"
                      >
                        Remove lend
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setIsLend(true); setEditingLentTo(true); }}
                      className="w-full rounded-full border border-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
                    >
                      Turn into a lend
                    </button>
                  )}
                </div>
              )}

              {/* Payment method chips */}
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {PAYMENT_METHODS.map((m) => {
                  const sel = pm === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => { setPm(m.key); haptic("tick"); }}
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

              {/* Custom keypad */}
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
                className="mt-3 transition-[padding] duration-150"
                style={{ paddingBottom: kb ? kb : 0 }}
              >
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={commit}
                  className="flex w-full items-center justify-center gap-2 rounded-full py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white"
                  style={{ background: "#22C55E" }}
                >
                  Save changes
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Portal to body so the popup sits above the bottom pill regardless of
  // any transformed ancestor stacking contexts.
  return createPortal(node, document.body);
}
