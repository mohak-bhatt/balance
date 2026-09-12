import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X, Pencil, Check } from "lucide-react";
import { Icon } from "./Icon";
import { CategoryPicker } from "./CategoryPicker";
import { IconPicker } from "./IconPicker";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useKeyboardOffset } from "@/hooks/useKeyboardOffset";
import { useOverlayState } from "@/lib/OverlayContext";
import { CATEGORIES, PAYMENT_METHODS, PICKABLE_EXPENSE_CATEGORIES, PICKABLE_INCOME_CATEGORIES, type Favorite, type PaymentMethod } from "@/lib/ledger";
import { useCategoryColor } from "@/lib/themes";
import { showInfo } from "@/lib/undo";
import { haptic } from "@/lib/haptics";


interface Props {
  open: boolean;
  onClose: () => void;
  favorites: Favorite[];
  onAdd: (f: Omit<Favorite, "id">) => void;
  onUpdate: (id: string, f: Omit<Favorite, "id">) => void;
  onDelete: (id: string) => void;
  /** "manage" shows the saved list + form; "compact" hides the list (create/edit only). */
  mode?: "manage" | "compact";
  /** When provided in compact mode, the form opens pre-filled to edit this favorite. */
  initialEdit?: Favorite | null;
}

export function FavoriteEditor({
  open, onClose, favorites, onAdd, onUpdate, onDelete,
  mode = "manage", initialEdit = null,
}: Props) {
  useOverlayState(open, onClose);
  const [editingId, setEditingId] = useState<string | null>(null);
  const kb = useKeyboardOffset();
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].key);
  const [icon, setIcon] = useState("Star");
  const [preset, setPreset] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const themeColor = useCategoryColor();
  const favoriteCategories = [...PICKABLE_EXPENSE_CATEGORIES, ...PICKABLE_INCOME_CATEGORIES];
  useBodyScrollLock(open);


  const resetForm = () => {
    setEditingId(null);
    setLabel(""); setCategory(CATEGORIES[0].key); setIcon("Star"); setPreset(""); setPaymentMethod(null);
  };

  useEffect(() => {
    if (!open) { resetForm(); return; }
    if (initialEdit) {
      setEditingId(initialEdit.id);
      setLabel(initialEdit.label);
      setCategory(initialEdit.category);
      setIcon(initialEdit.icon || "Star");
      setPreset(initialEdit.presetAmount != null ? String(initialEdit.presetAmount) : "");
      setPaymentMethod(initialEdit.paymentMethod ?? null);
    } else {
      resetForm();
    }
  }, [open, initialEdit]);

  const startEdit = (f: Favorite) => {
    setEditingId(f.id);
    setLabel(f.label);
    setCategory(f.category);
    setIcon(f.icon || "Star");
    setPreset(f.presetAmount != null ? String(f.presetAmount) : "");
    setPaymentMethod(f.paymentMethod ?? null);
  };

  const save = () => {
    if (!label.trim()) return;
    const amt = parseFloat(preset);
    const payload: Omit<Favorite, "id"> = {
      label: label.trim(),
      category,
      icon,
      presetAmount: isNaN(amt) ? null : amt,
      paymentMethod: paymentMethod ?? undefined,
    };
    const wasEdit = !!editingId;
    if (editingId) onUpdate(editingId, payload);
    else onAdd(payload);
    haptic("success");
    resetForm();
    onClose();
    showInfo(wasEdit ? "Favourite updated" : "Favourite added");
  };



  const node = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0 }} animate={{ y: kb ? -kb : 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32, mass: 0.9 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            dragMomentum={false}
            onDragEnd={(event, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                onClose();
              }
            }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92vh] w-full max-w-md overflow-x-hidden overflow-y-auto rounded-t-[32px] border-t border-white/10 bg-black p-5 pb-8"
            style={{
              background: "rgba(15, 15, 15, 0.65)",
              backdropFilter: "blur(10px) saturate(150%)",
              WebkitBackdropFilter: "blur(10px) saturate(150%)",
              borderColor: "rgba(255,255,255,0.08)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 -20px 60px -20px rgba(0,0,0,0.8)",
            }}
          >
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-white/15" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                  {mode === "compact" ? (editingId ? "Edit" : "New") : "Manage"}
                </p>
                <h2 className="font-mono-display text-xl text-foreground/95">
                  {mode === "compact" ? "FAVORITE" : "FAVORITES"}
                </h2>
              </div>
              <button onClick={onClose} className="rounded-full p-2 text-muted-foreground">
                <X size={18} strokeWidth={1.5} />
              </button>
            </div>

            {/* Existing list */}
            {mode === "manage" && favorites.length > 0 && (
              <div className="mt-5 space-y-1">
                <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Saved · {favorites.length}
                </p>
                {favorites.map((f) => {
                  const isEditing = editingId === f.id;
                  return (
                    <motion.div
                      layout
                      key={f.id}
                      className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors ${
                        isEditing
                          ? "border-white/20 bg-white/[0.06]"
                          : "border-white/[0.06] bg-white/[0.02]"
                      }`}
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08]">
                        <Icon name={f.icon} size={15} strokeWidth={1.5} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.label}</p>
                        <p className="truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {(CATEGORIES.find((c) => c.key === f.category)?.label) ?? "—"}
                          {f.presetAmount != null && ` · ₹${f.presetAmount}`}
                        </p>
                      </div>
                      <button
                        onClick={() => (isEditing ? resetForm() : startEdit(f))}
                        className="rounded-full p-2 text-muted-foreground active:opacity-60"
                        aria-label={isEditing ? "Cancel" : "Edit"}
                      >
                        {isEditing ? <X size={14} /> : <Pencil size={14} strokeWidth={1.6} />}
                      </button>
                      <button
                        onClick={() => { haptic("thud"); onDelete(f.id); }}
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

            {/* Form */}
            <div className="editor-card mt-5 rounded-2xl p-4">
              <p className="editor-eyebrow mb-3">
                {editingId ? "Editing favorite" : "New favorite"}
              </p>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPickerOpen(true)}
                  className="editor-field grid h-14 w-14 shrink-0 place-items-center rounded-full p-0"
                >
                  <Icon name={icon} size={22} strokeWidth={1.5} />
                </button>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Label"
                  className="editor-field h-14 w-full rounded-2xl text-base placeholder:text-muted-foreground/70 focus:border-white/30"
                />
              </div>

              <CategoryPicker
                categories={favoriteCategories}
                selectedKey={category}
                colorFor={themeColor}
                onSelect={(selected) => setCategory(selected.key)}
              />

              <p className="editor-eyebrow mt-4">
                Preset amount · optional
              </p>
                <div className="editor-field mt-2 flex h-14 items-center gap-2 rounded-2xl">
                <span className="font-mono-display text-sm text-muted-foreground">₹</span>
                <input
                  type="number"
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                  placeholder="Leave blank to enter every time"
                  className="font-mono-display w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>

              <p className="editor-eyebrow mt-4">
                Payment method · optional
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button
                  onClick={() => setPaymentMethod(null)}
                  className={`flex h-11 items-center gap-1.5 rounded-full border px-4 text-[11px] ${
                    paymentMethod === null ? "border-white/40 text-foreground" : "border-white/10 text-muted-foreground"
                  }`}
                >
                  Ask when tapped
                </button>
                {PAYMENT_METHODS.map((m) => {
                  const sel = paymentMethod === m.key;
                  return (
                    <button
                      key={m.key}
                      onClick={() => setPaymentMethod(m.key)}
                      className={`flex h-11 items-center gap-1.5 rounded-full border px-4 text-[11px] ${
                        sel ? "border-white/40 text-foreground" : "border-white/10 text-muted-foreground"
                      }`}
                    >
                      <Icon name={m.icon} size={11} strokeWidth={1.6} />
                      {m.label}
                    </button>
                  );
                })}
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
                  disabled={!label.trim()}
                    className="editor-field flex h-14 flex-1 items-center justify-center gap-2 rounded-full text-[11px] uppercase tracking-[0.22em] text-foreground disabled:opacity-40"
                >
                  <Check size={14} strokeWidth={1.8} />
                  {editingId ? "Update" : "Save favorite"}
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