import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, Delete, X } from "lucide-react";
import { Icon } from "./Icon";
import { CategoryIconPopup } from "./CategoryIconPopup";
import { NoteField } from "./NoteField";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { useOverlayState } from "@/lib/OverlayContext";
import {
  LENT_OUT_KEY,
  PAYMENT_METHODS,
  PICKABLE_EXPENSE_CATEGORIES,
  PICKABLE_INCOME_CATEGORIES,
  type PaymentMethod,
  type Transaction,
} from "@/lib/ledger";
import { useCategoryColor } from "@/lib/themes";
import { haptic } from "@/lib/haptics";

interface Props {
  open: boolean;
  tx: Transaction | null;
  onClose: () => void;
  onSave: (tx: Transaction) => void;
  sheetTopPx?: number;
}

const DEFAULT_SHEET_TOP_PX = 96;
const ROW_H = 40; // px per wheel row
const VISIBLE_ROWS = 5; // odd, so there's a clear center row

/** One iOS-style scrolling wheel column. Snaps to the nearest row and reports its index. */
function WheelColumn({
  items, index, onChange, align = "center", widthClass = "w-full",
}: {
  items: string[];
  index: number;
  onChange: (i: number) => void;
  align?: "center" | "left";
  widthClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const padY = (ROW_H * (VISIBLE_ROWS - 1)) / 2;
  const lastReported = useRef(index);
  const scrollTimer = useRef<number | null>(null);

  // Keep the wheel's scroll position in sync when `index` changes externally.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = index * ROW_H;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
  }, [index]);

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    if (scrollTimer.current) window.clearTimeout(scrollTimer.current);
    scrollTimer.current = window.setTimeout(() => {
      const raw = el.scrollTop / ROW_H;
      const snapped = Math.max(0, Math.min(items.length - 1, Math.round(raw)));
      el.scrollTo({ top: snapped * ROW_H, behavior: "smooth" });
      if (snapped !== lastReported.current) {
        lastReported.current = snapped;
        haptic("tick");
        onChange(snapped);
      }
    }, 80);
  };

  return (
    <>
      <style>{`.balance-wheel-col::-webkit-scrollbar { display: none; }`}</style>
      <div
        ref={ref}
        onScroll={handleScroll}
        className={`balance-wheel-col relative overflow-y-scroll ${widthClass}`}
        style={{
          scrollSnapType: "y mandatory",
          height: ROW_H * VISIBLE_ROWS,
          paddingTop: padY,
          paddingBottom: padY,
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {items.map((label, i) => (
          <div
            key={i}
            className={`flex items-center font-mono-display text-lg tabular-nums transition-opacity ${
              i === index ? "text-foreground opacity-100" : "text-muted-foreground opacity-50"
            } ${align === "center" ? "justify-center" : "justify-start pl-4"}`}
            style={{ height: ROW_H, scrollSnapAlign: "center" }}
          >
            {label}
          </div>
        ))}
      </div>
    </>
  );
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Builds a rolling window of dates (past + a little future) for the day wheel. */
function buildDayOptions(centerOn: Date): { label: string; date: Date }[] {
  const days: { label: string; date: Date }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let offset = -365; offset <= 30; offset++) {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    let label: string;
    if (offset === 0) label = "Today";
    else if (offset === -1) label = "Yesterday";
    else if (offset === 1) label = "Tomorrow";
    else label = `${d.getDate()} ${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;
    days.push({ label, date: d });
  }
  void centerOn;
  return days;
}

/** Centered popup for editing date & time with iOS-style scrolling wheels. */
function EditTimePopup({
  open, value, onChange, onClose,
}: { open: boolean; value: string; onChange: (iso: string) => void; onClose: () => void }) {
  useBodyScrollLock(open);
  const initial = useMemo(() => new Date(value), [value]);
  const dayOptions = useMemo(() => buildDayOptions(initial), [initial]);

  const [dayIdx, setDayIdx] = useState(0);
  const [hour12, setHour12] = useState(12);
  const [minute, setMinute] = useState(0);
  const [ampmIdx, setAmpmIdx] = useState(0); // 0 = AM, 1 = PM

  useEffect(() => {
    if (!open) return;
    const d = new Date(value);
    const dayStart = new Date(d);
    dayStart.setHours(0, 0, 0, 0);
    const found = dayOptions.findIndex((o) => o.date.getTime() === dayStart.getTime());
    setDayIdx(found >= 0 ? found : dayOptions.findIndex((o) => o.label === "Today"));
    const h = d.getHours();
    setHour12(h % 12 === 0 ? 12 : h % 12);
    setMinute(d.getMinutes());
    setAmpmIdx(h >= 12 ? 1 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const hourLabels = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const minuteLabels = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
  const ampmLabels = ["AM", "PM"];

  const handleDone = () => {
    const base = new Date(dayOptions[dayIdx]?.date ?? new Date());
    let h24 = hour12 % 12;
    if (ampmIdx === 1) h24 += 12;
    base.setHours(h24, minute, 0, 0);
    onChange(base.toISOString());
    onClose();
  };

  const node = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[140] bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="fixed left-1/2 top-1/2 z-[141] w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-3xl border p-4"
            style={{
              background: "rgba(15, 15, 15, 0.85)",
              backdropFilter: "blur(16px) saturate(150%)",
              WebkitBackdropFilter: "blur(16px) saturate(150%)",
              borderColor: "rgba(255,255,255,0.08)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 20px 60px -10px rgba(0,0,0,0.9)",
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-mono-display text-lg text-foreground/95">EDIT TIME</h3>
              <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground hover:bg-white/5">
                <X size={16} />
              </button>
            </div>

            {/* Wheel picker with a highlighted center row, iOS-style */}
            <div className="relative">
              <div
                className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 rounded-xl border-y border-white/15 bg-white/[0.04]"
                style={{ height: ROW_H }}
              />
              <div className="flex items-stretch gap-1">
                <WheelColumn
                  items={dayOptions.map((o) => o.label)}
                  index={dayIdx}
                  onChange={setDayIdx}
                  align="left"
                  widthClass="flex-[1.6]"
                />
                <WheelColumn items={hourLabels} index={hour12 - 1} onChange={(i) => setHour12(i + 1)} widthClass="flex-1" />
                <WheelColumn items={minuteLabels} index={minute} onChange={setMinute} widthClass="flex-1" />
                <WheelColumn items={ampmLabels} index={ampmIdx} onChange={setAmpmIdx} widthClass="flex-[0.8]" />
              </div>
            </div>

            <button
              onClick={handleDone}
              className="editor-field mt-4 flex h-14 w-full items-center justify-center rounded-full text-[11px] uppercase tracking-[0.22em] text-foreground"
            >
              Done
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}

export function EditTransactionPopup({ open, tx, onClose, onSave, sheetTopPx }: Props) {
  useOverlayState(open && !!tx, onClose);
  const SHEET_TOP_PX = Math.max(88, sheetTopPx ?? DEFAULT_SHEET_TOP_PX);
  const [title, setTitle] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [pm, setPm] = useState<PaymentMethod>("cash");
  const [lentTo, setLentTo] = useState("");
  const [editingLentTo, setEditingLentTo] = useState(false);
  const [isLend, setIsLend] = useState(false);
  const [category, setCategory] = useState<string>("misc");
  const [icon, setIcon] = useState<string>("Sparkles");
  const [timestamp, setTimestamp] = useState<string>(new Date().toISOString());
  const [catPopupOpen, setCatPopupOpen] = useState(false);
  const [timePopupOpen, setTimePopupOpen] = useState(false);
  const kb = useKeyboardOffset();
  const themeColor = useCategoryColor();

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
    setTimestamp(tx.timestamp);
    setEditingTitle(false);
    setEditingLentTo(false);
    setCatPopupOpen(false);
    setTimePopupOpen(false);
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
      timestamp,
    });
    haptic("success");
    onClose();
  };

  const accent = tx.direction === "in" ? "#10B981" : "#F87171";
  const sign = tx.direction === "in" ? "+" : "−";
  const catPool = tx.direction === "in" ? PICKABLE_INCOME_CATEGORIES : PICKABLE_EXPENSE_CATEGORIES;
  const selectedCategoryColor = themeColor(category);

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
            className="fixed inset-x-0 z-[130] mx-auto w-full max-w-md overflow-hidden overflow-x-hidden rounded-t-[28px] border-t border-white/10"
            style={{ top: SHEET_TOP_PX, bottom: 0, background: "#000000" }}
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

            <div className="mx-auto flex h-[calc(100%-1.25rem)] max-w-md flex-col bg-black px-6 pt-14 pb-5">
              {/* Header: eyebrow + title, with category + edit-time icons spanning both lines */}
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Edit · {isLend ? "Lend" : (tx.direction === "in" ? "Income" : "Expense")}
              </p>
              <div className="mt-0.5 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  {editingTitle ? (
                    <input
                      autoFocus
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => setEditingTitle(false)}
                      onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
                      className="w-full bg-transparent text-2xl font-semibold outline-none border-b border-white/20"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingTitle(true)}
                      className="block w-full truncate text-left text-2xl font-semibold"
                    >
                      {isLend ? `Lent to ${lentTo || "—"}` : (title || "Untitled")}
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setTimePopupOpen(true)}
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-foreground/80"
                  aria-label="Change date & time"
                >
                  <Calendar size={20} strokeWidth={1.6} />
                </button>

                {!isLend && (
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

              {/* Amount display — centered as one unified block */}
              <div className="mt-4 flex items-baseline justify-center">
                <span className="inline-flex items-baseline gap-1.5">
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
                </span>
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

              {/* Payment method chips — exactly 5 equal columns, always one line */}
              <div className="mt-3 flex gap-1.5">
                {PAYMENT_METHODS.map((m) => {
                  const sel = pm === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => { setPm(m.key); haptic("tick"); }}
                      className={`flex-1 flex min-h-9 items-center justify-center gap-1 rounded-full border px-2 py-1.5 text-center text-[9px] leading-tight ${
                        sel ? "border-white/40 text-foreground" : "border-white/10 text-muted-foreground"
                      }`}
                    >
                      <Icon name={m.icon} size={10} strokeWidth={1.6} className="shrink-0" />
                      <span className="leading-tight">{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Add-a-note — below payment methods, above keypad */}
              <div className="mt-3">
                <NoteField value={note} onChange={setNote} />
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

          <CategoryIconPopup
            open={catPopupOpen}
            categories={catPool}
            selectedKey={category}
            colorFor={themeColor}
            onSelect={(selected) => {
              setCategory(selected.key); setIcon(selected.icon); haptic("tick");
            }}
            onClose={() => setCatPopupOpen(false)}
          />

          <EditTimePopup
            open={timePopupOpen}
            value={timestamp}
            onChange={setTimestamp}
            onClose={() => setTimePopupOpen(false)}
          />
        </>
      )}
    </AnimatePresence>
  );

  // Portal to body so the popup sits above the bottom pill regardless of
  // any transformed ancestor stacking contexts.
  return createPortal(node, document.body);
}