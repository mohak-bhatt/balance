import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X, Pencil, Check } from "lucide-react";
import { Icon } from "./Icon";
import { IconPicker } from "./IconPicker";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  PAYMENT_METHODS,
  PICKABLE_EXPENSE_CATEGORIES,
  PICKABLE_INCOME_CATEGORIES,
  type Direction,
  type Loop,
  type PaymentMethod,
} from "@/lib/ledger";
import { useCategoryColor } from "@/lib/themes";
import { showInfo } from "@/lib/undo";
import { haptic } from "@/lib/haptics";


interface Props {
  open: boolean;
  onClose: () => void;
  loops: Loop[];
  onAdd: (l: Omit<Loop, "id" | "lastAppliedDate">) => void;
  onUpdate: (id: string, l: Omit<Loop, "id" | "lastAppliedDate">) => void;
  onDelete: (id: string) => void;
  mode?: "manage" | "compact";
  initialEdit?: Loop | null;
}

export function LoopEditor({
  open, onClose, loops, onAdd, onUpdate, onDelete,
  mode = "manage", initialEdit = null,
}: Props) {
  const themeColor = useCategoryColor();
  useBodyScrollLock(open);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("Repeat");
  const [direction, setDirection] = useState<Direction>("out");
  const [category, setCategory] = useState(PICKABLE_EXPENSE_CATEGORIES[0].key);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [day, setDay] = useState<string>("1");
  const [pickerOpen, setPickerOpen] = useState(false);

  const resetForm = () => {
    setEditingId(null);
    setLabel(""); setIcon("Repeat"); setDirection("out");
    setCategory(PICKABLE_EXPENSE_CATEGORIES[0].key);
    setAmount(""); setMethod("upi"); setDay("1");
  };

  useEffect(() => {
    if (!open) { resetForm(); return; }
    if (initialEdit) {
      setEditingId(initialEdit.id);
      setLabel(initialEdit.label);
      setIcon(initialEdit.icon);
      setDirection(initialEdit.direction);
      setCategory(initialEdit.category);
      setAmount(String(initialEdit.amount));
      setMethod(initialEdit.paymentMethod);
      setDay(String(initialEdit.recurrenceDayOfMonth));
    } else {
      resetForm();
    }
  }, [open, initialEdit]);

  useEffect(() => {
    const pool = direction === "in" ? PICKABLE_INCOME_CATEGORIES : PICKABLE_EXPENSE_CATEGORIES;
    if (!pool.find((c) => c.key === category)) setCategory(pool[0].key);
  }, [direction, category]);

  const startEdit = (l: Loop) => {
    setEditingId(l.id);
    setLabel(l.label);
    setIcon(l.icon);
    setDirection(l.direction);
    setCategory(l.category);
    setAmount(String(l.amount));
    setMethod(l.paymentMethod);
    setDay(String(l.recurrenceDayOfMonth));
  };

  const save = () => {
    const amt = parseFloat(amount);
    const dayNum = parseInt(day, 10);
    if (!label.trim() || isNaN(amt) || amt <= 0 || isNaN(dayNum)) return;
    const payload: Omit<Loop, "id" | "lastAppliedDate"> = {
      label: label.trim(),
      icon, category, direction,
      amount: amt,
      paymentMethod: method,
      recurrenceDayOfMonth: Math.min(28, Math.max(1, dayNum)),
    };
    const wasEdit = !!editingId;
    if (editingId) onUpdate(editingId, payload);
    else onAdd(payload);
    haptic("success");
    resetForm();
    onClose();
    showInfo(wasEdit ? "Loop updated" : "Loop added");
  };


  const pool = direction === "in" ? PICKABLE_INCOME_CATEGORIES : PICKABLE_EXPENSE_CATEGORIES;

  const node = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            className="liquid-glass fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-[32px] p-5 pb-8"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {mode === "compact" ? (editingId ? "Edit" : "New") : "Manage"}
                </p>
                <h2 className="font-mono-display text-xl text-foreground/95">
                  {mode === "compact" ? "LOOP" : "LOOPS"}
                </h2>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-muted-foreground">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {mode === "manage" && loops.length > 0 && (
              <div className="mt-5 space-y-1">
                <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Active · {loops.length}
                </p>
                {loops.map((l) => {
                  const isEditing = editingId === l.id;
                  return (
                    <motion.div
                      layout
                      key={l.id}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${
                        isEditing
                          ? "border-white/20 bg-white/[0.06]"
                          : "border-white/[0.06] bg-white/[0.02]"
                      }`}
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08]">
                        <Icon name={l.icon} size={15} strokeWidth={1.5} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{l.label}</p>
                        <p className="font-mono-display truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {l.direction === "in" ? "+" : "−"}₹{l.amount} · day {l.recurrenceDayOfMonth}
                        </p>
                      </div>
                      <button
                        onClick={() => (isEditing ? resetForm() : startEdit(l))}
                        className="rounded-full p-2 text-muted-foreground active:opacity-60"
                        aria-label={isEditing ? "Cancel" : "Edit"}
                      >
                        {isEditing ? <X size={14} /> : <Pencil size={14} strokeWidth={1.6} />}
                      </button>
                      <button
                        onClick={() => { haptic("thud"); onDelete(l.id); }}
                        className="rounded-full p-2 text-muted-foreground active:opacity-60"
                        aria-label="Delete"
                      >
                        <Trash2 size={14} strokeWidth={1.6} />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}

            <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {editingId ? "Editing loop" : "New loop"}
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPickerOpen(true)}
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/[0.08] bg-white/[0.03]"
                >
                  <Icon name={icon} size={22} strokeWidth={1.5} />
                </button>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Label (e.g. Netflix)"
                  className="w-full border-b border-white/10 bg-transparent pb-1.5 text-base outline-none placeholder:text-muted-foreground focus:border-foreground/40"
                />
              </div>

              <div className="mt-4 flex gap-2">
                {(["out", "in"] as Direction[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className={`flex-1 rounded-full border py-2 text-[10px] uppercase tracking-[0.22em] ${
                      direction === d
                        ? "border-white/30 bg-white/[0.05] text-foreground"
                        : "border-white/[0.06] text-muted-foreground"
                    }`}
                  >
                    {d === "in" ? "Income" : "Expense"}
                  </button>
                ))}
              </div>

              <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Category</p>
              <div className="mt-2 -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                {pool.map((c) => {
                  const sel = c.key === category;
                  const color = themeColor(c.key);
                  return (
                    <button
                      key={c.key}
                      onClick={() => setCategory(c.key)}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
                      style={sel ? {
                        background: `color-mix(in oklab, ${color} 18%, transparent)`,
                        borderColor: color,
                        color: color,
                      } : { borderColor: "rgba(255,255,255,0.08)", background: "transparent" }}
                    >
                      <Icon name={c.icon} size={12} strokeWidth={1.6} />
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Amount</p>
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <span className="font-mono-display text-sm text-muted-foreground">₹</span>
                    <input
                      type="number" value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="font-mono-display w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Day of month</p>
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={day}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^0-9]/g, "");
                        setDay(v.slice(0, 2));
                      }}
                      placeholder="1–28"
                      className="font-mono-display w-full bg-transparent text-sm outline-none"
                    />
                  </div>
                </div>
              </div>

              <p className="mt-4 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Payment method</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setMethod(m.key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs ${
                      method === m.key
                        ? "border-white/30 bg-white/[0.06] text-foreground"
                        : "border-white/[0.06] text-muted-foreground"
                    }`}
                  >
                    <Icon name={m.icon} size={11} strokeWidth={1.6} /> {m.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                {editingId && (
                  <button
                    onClick={resetForm}
                    className="rounded-full border border-white/[0.08] px-4 py-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
                  >
                    Cancel
                  </button>
                )}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={save}
                  disabled={!label.trim() || !(parseFloat(amount) > 0)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 bg-white/[0.06] py-3 text-[11px] uppercase tracking-[0.22em] text-foreground disabled:opacity-30"
                >
                  <Check size={14} strokeWidth={1.8} />
                  {editingId ? "Update" : "Save loop"}
                </motion.button>
              </div>
            </div>
          </motion.div>

          <IconPicker
            open={pickerOpen}
            selected={icon}
            onSelect={setIcon}
            onClose={() => setPickerOpen(false)}
          />
        </>
      )}
    </AnimatePresence>
  );

  if (typeof document === "undefined") return null;
  return createPortal(node, document.body);
}
