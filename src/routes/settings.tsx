import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Camera, Pencil, Plus, ArrowDown, ArrowUp, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import {
  loadState, saveState, CATEGORIES, getCategory, formatCurrency,
  type Favorite, type Loop,
} from "@/lib/ledger";
import { Icon } from "@/components/Icon";
import { FavoriteEditor } from "@/components/FavoriteEditor";
import { LoopEditor } from "@/components/LoopEditor";
import { SwipeDeleteRow } from "@/components/SwipeDeleteRow";
import {
  THEME_META, colorFor, loadTheme, saveTheme, type ThemeState, type ThemeId,
} from "@/lib/themes";
import { clearAvatar, initials, loadAvatar, saveAvatar } from "@/lib/avatar";

import { showUndo } from "@/lib/undo";
import mackieb from "@/assets/mackie-b.png";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Balance" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [notif, setNotif] = useState(false);
  const [theme, setTheme] = useState<ThemeState>(loadTheme());
  const [avatar, setAvatar] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoMenuOpen, setPhotoMenuOpen] = useState(false);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  
  const [confirmRemovePhoto, setConfirmRemovePhoto] = useState(false);

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loops, setLoops] = useState<Loop[]>([]);

  const [favEditOpen, setFavEditOpen] = useState(false);
  const [favEditTarget, setFavEditTarget] = useState<Favorite | null>(null);
  const [loopEditOpen, setLoopEditOpen] = useState(false);
  const [loopEditTarget, setLoopEditTarget] = useState<Loop | null>(null);

  // (swipe-to-delete commits immediately — no confirmation modal needed)

  useEffect(() => {
    const s = loadState();
    setName(s.userName ?? "");
    setNotif(!!s.notificationsEnabled);
    setFavorites(s.favorites);
    setLoops(s.loops);
    loadAvatar().then(setAvatar);
  }, []);

  useBodyScrollLock(customOpen || photoMenuOpen || confirmRemovePhoto || photoViewerOpen || confirmReset);


  // Favorites CRUD
  const addFavorite = (f: Omit<Favorite, "id">) => {
    const s = loadState();
    const next = { ...s, favorites: [...s.favorites, { ...f, id: crypto.randomUUID() }] };
    saveState(next); setFavorites(next.favorites);
  };
  const updateFavorite = (id: string, f: Omit<Favorite, "id">) => {
    const s = loadState();
    const next = { ...s, favorites: s.favorites.map((x) => (x.id === id ? { ...f, id } : x)) };
    saveState(next); setFavorites(next.favorites);
  };
  const deleteFavorite = (id: string) => {
    const s = loadState();
    const idx = s.favorites.findIndex((f) => f.id === id);
    const old = idx >= 0 ? s.favorites[idx] : undefined;
    const next = { ...s, favorites: s.favorites.filter((f) => f.id !== id) };
    saveState(next); setFavorites(next.favorites);
    if (old) {
      showUndo("Favourite removed", () => {
        const cur = loadState();
        if (cur.favorites.some((f) => f.id === old.id)) return;
        const arr = [...cur.favorites];
        arr.splice(Math.min(idx, arr.length), 0, old);
        const restored = { ...cur, favorites: arr };
        saveState(restored); setFavorites(restored.favorites);
      });
    }
  };

  // Loops CRUD
  const addLoop = (l: Omit<Loop, "id" | "lastAppliedDate">) => {
    const s = loadState();
    const next = {
      ...s,
      loops: [...s.loops, { ...l, id: crypto.randomUUID(), lastAppliedDate: null }],
    };
    saveState(next); setLoops(next.loops);
  };
  const updateLoop = (id: string, l: Omit<Loop, "id" | "lastAppliedDate">) => {
    const s = loadState();
    const next = { ...s, loops: s.loops.map((x) => (x.id === id ? { ...x, ...l } : x)) };
    saveState(next); setLoops(next.loops);
  };
  const deleteLoop = (id: string) => {
    const s = loadState();
    const idx = s.loops.findIndex((l) => l.id === id);
    const old = idx >= 0 ? s.loops[idx] : undefined;
    const next = { ...s, loops: s.loops.filter((l) => l.id !== id) };
    saveState(next); setLoops(next.loops);
    if (old) {
      showUndo("Loop removed", () => {
        const cur = loadState();
        if (cur.loops.some((l) => l.id === old.id)) return;
        const arr = [...cur.loops];
        arr.splice(Math.min(idx, arr.length), 0, old);
        const restored = { ...cur, loops: arr };
        saveState(restored); setLoops(restored.loops);
      });
    }
  };

  const commitName = (n: string) => {
    const s = loadState();
    saveState({ ...s, userName: n });
  };

  const toggleNotif = async (v: boolean) => {
    setNotif(v);
    const s = loadState();
    saveState({ ...s, notificationsEnabled: v });
    if (v && typeof Notification !== "undefined" && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch { /* */ }
    }
  };

  const applyTheme = (id: ThemeId) => {
    const next: ThemeState = id === "custom" ? { id: "custom", customMap: theme.customMap ?? {} } : { id };
    setTheme(next); saveTheme(next);
  };

  const onPickFile = async (f: File) => {
    setError(null);
    if (f.size > 20 * 1024 * 1024) { setError("Image must be under 20MB"); return; }
    await saveAvatar(f);
    const url = await loadAvatar();
    setAvatar(url);
  };
  const removePhoto = async () => {
    await clearAvatar();
    setAvatar(null);
    setConfirmRemovePhoto(false);
  };

  const resetApp = async () => {
    Object.keys(localStorage).filter((k) => k.startsWith("balance")).forEach((k) => localStorage.removeItem(k));
    await clearAvatar();
    navigate({ to: "/onboarding" });
  };

  return (
    <>
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 32, mass: 0.8 }}
      className="relative mx-auto min-h-screen w-full max-w-md px-5 pb-32"
      style={{ paddingTop: 52 }}
    >

      <div className="flex items-center justify-between">
        <Link to="/" className="grid h-10 w-10 place-items-center -ml-2">
          <ChevronLeft size={22} strokeWidth={1.5} />
        </Link>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Settings</p>
        <div className="w-10" />
      </div>

      {/* User info */}
      <section className="mt-10 flex flex-col items-center gap-4">
        <button
          onClick={() => {
            if (longPressFiredRef.current) {
              longPressFiredRef.current = false;
              return;
            }
            setPhotoMenuOpen(true);
          }}
          onPointerDown={() => {
            longPressFiredRef.current = false;
            if (!avatar) return;
            longPressTimer.current = setTimeout(() => {
              longPressFiredRef.current = true;
              setPhotoViewerOpen(true);
            }, 450);
          }}
          onPointerUp={() => {
            if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
          }}
          onPointerLeave={() => {
            if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
          }}
          onContextMenu={(e) => e.preventDefault()}
          className="relative grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-white/15 select-none"
        >
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <span className="font-mono-display text-2xl">{initials(name || "?")}</span>
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = ""; }}
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => commitName(name)}
          placeholder="Your name"
          className="w-full max-w-[14rem] border-b border-white/10 bg-transparent pb-2 text-center font-mono-display text-lg outline-none focus:border-white/40"
        />
      </section>

      {/* Manage Favourites */}
      <section className="mt-12">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Manage favourites
        </p>
        <div className="mt-3">
          {favorites.length === 0 ? (
            <p className="py-4 text-xs text-muted-foreground">No favourites yet.</p>
          ) : (
            favorites.map((f) => (
              <SwipeDeleteRow key={f.id} onDelete={() => deleteFavorite(f.id)}>
                <div className="flex items-center gap-3 border-b border-white/[0.06] px-1 py-3">
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-white/10">
                    <Icon name={f.icon} size={15} strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{f.label}</p>
                    <p className="font-mono-display truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {f.presetAmount != null ? formatCurrency(f.presetAmount) : "Set amount"}
                    </p>
                  </div>
                  <button
                    onClick={() => { setFavEditTarget(f); setFavEditOpen(true); }}
                    className="grid h-9 w-9 place-items-center text-muted-foreground active:opacity-60"
                    aria-label="Edit favourite"
                  >
                    <Pencil size={15} strokeWidth={1.6} />
                  </button>
                </div>
              </SwipeDeleteRow>
            ))
          )}
        </div>
        <button
          onClick={() => { setFavEditTarget(null); setFavEditOpen(true); }}
          className="mt-3 flex w-full items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-[0.22em] text-foreground/85"
        >
          <Plus size={14} strokeWidth={1.8} /> Add favourite
        </button>
      </section>

      {/* Manage Loops */}
      <section className="mt-12">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          Manage loops
        </p>
        <div className="mt-3">
          {loops.length === 0 ? (
            <p className="py-4 text-xs text-muted-foreground">No loops yet.</p>
          ) : (
            loops.map((l) => (
              <SwipeDeleteRow key={l.id} onDelete={() => deleteLoop(l.id)}>
                <div className="flex items-center gap-3 border-b border-white/[0.06] px-1 py-3">
                  <span className="relative grid h-9 w-9 place-items-center rounded-full border border-white/10">
                    <Icon name={l.icon} size={15} strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{l.label}</p>
                    <p className="font-mono-display flex items-center gap-1 truncate text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {l.direction === "in" ? (
                        <ArrowUp size={10} strokeWidth={2} />
                      ) : (
                        <ArrowDown size={10} strokeWidth={2} />
                      )}
                      {formatCurrency(l.amount)} · day {l.recurrenceDayOfMonth}
                    </p>
                  </div>
                  <button
                    onClick={() => { setLoopEditTarget(l); setLoopEditOpen(true); }}
                    className="grid h-9 w-9 place-items-center text-muted-foreground active:opacity-60"
                    aria-label="Edit loop"
                  >
                    <Pencil size={15} strokeWidth={1.6} />
                  </button>
                </div>
              </SwipeDeleteRow>
            ))
          )}
        </div>
        <button
          onClick={() => { setLoopEditTarget(null); setLoopEditOpen(true); }}
          className="mt-3 flex w-full items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-[0.22em] text-foreground/85"
        >
          <Plus size={14} strokeWidth={1.8} /> Add loop
        </button>
      </section>

      {/* Theme */}
      <section className="mt-12">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Theme</p>
        <div className="mt-4 space-y-2">
          {THEME_META.map((m) => (
            <button
              key={m.id}
              onClick={() => applyTheme(m.id)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
                theme.id === m.id ? "border-white/40" : "border-white/10"
              }`}
            >
              <span className="text-sm">{m.label}</span>
              <span className="flex gap-1">
                {["food", "transport", "shopping", "bills", "entertainment"].map((k) => (
                  <span key={k} className="h-3.5 w-3.5 rounded-full" style={{ background: colorFor({ id: m.id }, k) }} />
                ))}
              </span>
            </button>
          ))}
          <button
            onClick={() => { applyTheme("custom"); setCustomOpen(true); }}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left ${
              theme.id === "custom" ? "border-white/40" : "border-white/10"
            }`}
          >
            <span className="text-sm">Custom</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Edit</span>
          </button>
        </div>
      </section>

      {/* Notifications */}
      <section className="mt-12">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Notifications</p>
        <label className="mt-4 flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
          <span className="text-sm">Weekly & monthly analytics alerts</span>
          <input
            type="checkbox"
            checked={notif}
            onChange={(e) => toggleNotif(e.target.checked)}
            className="h-4 w-4 accent-white"
          />
        </label>
      </section>

      {/* Danger */}
      <section className="mt-12">
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Danger zone</p>
        <button
          onClick={() => setConfirmReset(true)}
          className="mt-4 w-full rounded-xl border border-red-500/40 px-4 py-3 text-sm text-red-400"
        >
          Reset App
        </button>
      </section>

      {/* Credits */}
      <section className="mt-16 flex flex-col items-center text-center">
        <img
          src={mackieb}
          alt="An app by Mackie B"
          className="w-48 max-w-[62%] select-none"
          draggable={false}
        />
      </section>

    </motion.div>

      <AnimatePresence>
        {customOpen && (
          <CustomThemeSheet
            theme={theme}
            onClose={() => setCustomOpen(false)}
            onSave={(map) => { const next = { id: "custom" as const, customMap: map }; setTheme(next); saveTheme(next); setCustomOpen(false); }}
          />
        )}
        {confirmReset && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-6"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="liquid-glass w-full max-w-sm rounded-3xl p-6"
            >
              <p className="text-base">Reset everything?</p>
              <p className="mt-2 text-sm text-muted-foreground">
                This will permanently erase all your data and cannot be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-xl border border-white/10 py-2 text-sm">Cancel</button>
                <button onClick={resetApp} className="flex-1 rounded-xl bg-red-600 py-2 text-sm text-white">Reset</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <FavoriteEditor
        open={favEditOpen}
        onClose={() => { setFavEditOpen(false); setFavEditTarget(null); }}
        favorites={favorites}
        onAdd={addFavorite}
        onUpdate={updateFavorite}
        onDelete={deleteFavorite}
        mode="compact"
        initialEdit={favEditTarget}
      />
      <LoopEditor
        open={loopEditOpen}
        onClose={() => { setLoopEditOpen(false); setLoopEditTarget(null); }}
        loops={loops}
        onAdd={addLoop}
        onUpdate={updateLoop}
        onDelete={deleteLoop}
        mode="compact"
        initialEdit={loopEditTarget}
      />
      <AnimatePresence>
        {photoMenuOpen && (
          <motion.div
            key="photo-menu"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[90] flex items-end justify-center"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)" }}
            onClick={() => setPhotoMenuOpen(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
              className="liquid-glass mx-4 mb-6 w-full max-w-sm rounded-3xl p-3"
            >
              <button
                onClick={() => { setPhotoMenuOpen(false); fileRef.current?.click(); }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm hover:bg-white/5"
              >
                <Camera size={16} strokeWidth={1.6} />
                Change photo
              </button>
              <button
                disabled={!avatar}
                onClick={() => { setPhotoMenuOpen(false); setConfirmRemovePhoto(true); }}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm text-red-400 hover:bg-white/5 disabled:opacity-30"
              >
                <Trash2 size={16} strokeWidth={1.6} />
                Remove photo
              </button>
              <button
                onClick={() => setPhotoMenuOpen(false)}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm text-muted-foreground"
              >
                <X size={14} strokeWidth={1.6} /> Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
        {confirmRemovePhoto && (
          <motion.div
            key="confirm-remove-photo"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[95] grid place-items-center bg-black/70 px-6"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="liquid-glass w-full max-w-sm rounded-3xl p-6"
            >
              <p className="text-base">Remove your profile photo?</p>
              <p className="mt-2 text-sm text-muted-foreground">
                You can add a new one any time.
              </p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setConfirmRemovePhoto(false)} className="flex-1 rounded-xl border border-white/10 py-2 text-sm">Cancel</button>
                <button onClick={removePhoto} className="flex-1 rounded-xl bg-red-600 py-2 text-sm text-white">Remove</button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {photoViewerOpen && avatar && (
          <motion.div
            key="photo-viewer"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-between px-6 py-10"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(28px)" }}
            onClick={() => setPhotoViewerOpen(false)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setPhotoViewerOpen(false); }}
              className="self-end grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white"
              aria-label="Close"
            >
              <X size={18} strokeWidth={1.6} />
            </button>
            <motion.img
              src={avatar}
              alt=""
              draggable={false}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="h-72 w-72 rounded-full object-cover border border-white/20 shadow-2xl select-none"
            />
            <div
              className="flex w-full max-w-sm gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setPhotoViewerOpen(false); fileRef.current?.click(); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 bg-white/10 py-3 text-sm text-white"
              >
                <Camera size={15} strokeWidth={1.6} /> Change
              </button>
              <button
                onClick={() => { setPhotoViewerOpen(false); setConfirmRemovePhoto(true); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 py-3 text-sm text-red-300"
              >
                <Trash2 size={15} strokeWidth={1.6} /> Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function CustomThemeSheet({
  theme, onClose, onSave,
}: { theme: ThemeState; onClose: () => void; onSave: (map: Record<string, string>) => void }) {
  const [map, setMap] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const c of CATEGORIES) base[c.key] = theme.customMap?.[c.key] ?? getCategory(c.key).color;
    return base;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-end bg-black/70 sm:place-items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 40, scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 24 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="liquid-glass max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-3xl p-5 sm:rounded-3xl"
      >
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Custom theme</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {CATEGORIES.map((c) => (
            <label key={c.key} className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
              <input
                type="color"
                value={map[c.key]}
                onChange={(e) => setMap((m) => ({ ...m, [c.key]: e.target.value }))}
                className="h-7 w-7 cursor-pointer rounded-full border border-white/10 bg-transparent"
              />
              <span className="truncate text-xs">{c.label}</span>
            </label>
          ))}
        </div>
        <button
          onClick={() => onSave(map)}
          className="mt-6 w-full rounded-xl bg-white py-3 text-sm font-medium text-black"
        >
          Save theme
        </button>
      </motion.div>
    </motion.div>
  );
}
