import { supabase } from "@/lib/supabase";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createPortal } from "react-dom";
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
import { NOTHING_YELLOW } from "@/components/YellowArrow";
import {
  cancelMonthlyNotification,
  cancelWeeklyNotification,
  requestNotificationPermission,
  scheduleMonthlyNotification,
  scheduleWeeklyNotification,
} from "@/lib/notifications";

import { showUndo } from "@/lib/undo";
import { ScrollReveal } from "@/components/ScrollReveal";
import mackieb from "@/assets/mackie-b.png";
import { useAuth } from "@/lib/AuthContext";
import { useOverlayState } from "@/lib/OverlayContext";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Balance" }] }),
  component: SettingsPage,
});

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative h-7 w-12 rounded-full transition-colors"
      style={{ background: checked ? "#333434" : "rgba(255,255,255,0.15)" }}
    >
      <motion.div
        className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md"
        animate={{ left: checked ? 22 : 2 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

function SettingsPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [weeklyNotif, setWeeklyNotif] = useState(false);
  const [monthlyNotif, setMonthlyNotif] = useState(false);
  const [theme, setTheme] = useState<ThemeState>(loadTheme());
  const [avatar, setAvatar] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const [confirmRemovePhoto, setConfirmRemovePhoto] = useState(false);

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loops, setLoops] = useState<Loop[]>([]);
  const { userEmail, session } = useAuth();

  const [favEditOpen, setFavEditOpen] = useState(false);
  const [favEditTarget, setFavEditTarget] = useState<Favorite | null>(null);
  const [loopEditOpen, setLoopEditOpen] = useState(false);
  const [loopEditTarget, setLoopEditTarget] = useState<Loop | null>(null);

  // (swipe-to-delete commits immediately — no confirmation modal needed)

  useEffect(() => {
    const s = loadState();
    setName(s.userName ?? "");
    setWeeklyNotif(!!s.weeklyNotificationsEnabled);
    setMonthlyNotif(!!s.monthlyNotificationsEnabled);
    setFavorites(s.favorites);
    setLoops(s.loops);
    loadAvatar().then(setAvatar);
  }, []);

  useBodyScrollLock(customOpen || photoViewerOpen || confirmRemovePhoto || confirmReset || confirmLogout);

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

  const toggleWeeklyNotif = async (v: boolean) => {
    if (v) {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      await scheduleWeeklyNotification();
    } else {
      await cancelWeeklyNotification();
    }
    setWeeklyNotif(v);
    const s = loadState();
    saveState({ ...s, weeklyNotificationsEnabled: v });
  };

  const toggleMonthlyNotif = async (v: boolean) => {
    if (v) {
      const granted = await requestNotificationPermission();
      if (!granted) return;
      await scheduleMonthlyNotification();
    } else {
      await cancelMonthlyNotification();
    }
    setMonthlyNotif(v);
    const s = loadState();
    saveState({ ...s, monthlyNotificationsEnabled: v });
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

  const logOut = async () => {
    await supabase.auth.signOut();
    Object.keys(localStorage).filter((k) => k.startsWith("balance")).forEach((k) => localStorage.removeItem(k));
    navigate({ to: "/onboarding" });
  };

  const resetApp = async () => {
    if (session?.user) {
      const userId = session.user.id;
      await supabase.from("transactions").delete().eq("user_id", userId);
      await supabase.from("favorites").delete().eq("user_id", userId);
      await supabase.from("loops").delete().eq("user_id", userId);
      await supabase.from("profiles").delete().eq("id", userId);
      await supabase.auth.signOut();
    }
    Object.keys(localStorage).filter((k) => k.startsWith("balance")).forEach((k) => localStorage.removeItem(k));
    await clearAvatar();
    navigate({ to: "/onboarding" });
  };

  return (
    <>
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 34, mass: 0.9 }}
        className="relative mx-auto min-h-screen w-full max-w-md px-5 pb-32"
        style={{ paddingTop: 52, background: "#000000", minHeight: "100vh", overflowX: "hidden", WebkitOverflowScrolling: "touch" }}
      >
        <div className="flex items-center justify-between">
          <Link to="/" className="grid h-10 w-10 place-items-center -ml-2">
            <ChevronLeft size={22} strokeWidth={1.5} />
          </Link>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Settings</p>
          <div className="w-10" />
        </div>

        {/* User info */}
        <ScrollReveal once>
          <section className="mt-10 flex flex-col items-center gap-4">
            <motion.button
              onClick={() => setPhotoViewerOpen(true)}
              whileTap={{ scale: 1.05 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
              className={`relative grid h-28 w-28 place-items-center overflow-hidden rounded-full border border-white/15 select-none ${
                photoViewerOpen ? "opacity-0" : "opacity-100"
              }`}
            >
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                <span className="font-mono-display text-2xl">{initials(name || "?")}</span>
              )}
            </motion.button>
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
            {userEmail ? (
              <div
                className="w-fit max-w-full rounded-xl px-5 py-2 text-[13px] font-medium"
                style={{ background: "rgba(255,255,255,0.12)", color: "#ffffff" }}
              >
                {userEmail}
              </div>
            ) : (
              <button
                onClick={() => navigate({ to: "/login" })}
                className="w-fit max-w-full rounded-xl px-5 py-2 text-[13px] font-medium"
                style={{ background: NOTHING_YELLOW, color: "#000000" }}
              >
                Log in to keep your data synced
              </button>
            )}
          </section>
        </ScrollReveal>

        {/* Manage Favourites */}
        <ScrollReveal once>
          <section className="mt-12">
            <div
              className="rounded-[20px] border p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.06)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground text-center mb-3">
                Manage favourites
              </p>
              <div>
                {favorites.length > 0 ? (
                  favorites.map((f, idx) => (
                    <SwipeDeleteRow key={f.id} onDelete={() => deleteFavorite(f.id)} className="mx-1">
                      <div className={`flex items-center gap-3 bg-transparent px-3 py-3 ${idx !== favorites.length - 1 ? "border-b border-white/[0.06]" : ""}`}>
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
                ) : null}
              </div>
              <button
                onClick={() => { setFavEditTarget(null); setFavEditOpen(true); }}
                className="mt-3 flex w-full items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-[0.22em] text-foreground/85"
              >
                <Plus size={14} strokeWidth={1.8} /> Add favourite
              </button>
            </div>
          </section>
        </ScrollReveal>

        {/* Manage Loops */}
        <ScrollReveal once>
          <section className="mt-12">
            <div
              className="rounded-[20px] border p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.06)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground text-center mb-3">
                Manage loops
              </p>
              <div>
                {loops.length > 0 ? (
                  loops.map((l, idx) => (
                    <SwipeDeleteRow key={l.id} onDelete={() => deleteLoop(l.id)} className="mx-1">
                      <div className={`flex items-center gap-3 bg-transparent px-3 py-3 ${idx !== loops.length - 1 ? "border-b border-white/[0.06]" : ""}`}>
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
                ) : null}
              </div>
              <button
                onClick={() => { setLoopEditTarget(null); setLoopEditOpen(true); }}
                className="mt-3 flex w-full items-center justify-center gap-2 py-3 text-[11px] uppercase tracking-[0.22em] text-foreground/85"
              >
                <Plus size={14} strokeWidth={1.8} /> Add loop
              </button>
            </div>
          </section>
        </ScrollReveal>

        {/* Theme */}
        <ScrollReveal once>
          <section className="mt-12">
            <div
              className="rounded-[20px] border p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.06)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground text-center mb-3">
                Theme
              </p>
              <p className="text-xs text-muted-foreground text-center mb-4">
               Sets the colors used for category pills throughout the app
              </p>
              <div className="space-y-2">
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
            </div>
          </section>
        </ScrollReveal>

        {/* Notifications */}
        <ScrollReveal once>
          <section className="mt-12">
            <div
              className="rounded-[20px] border p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.06)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground text-center mb-3">
                Notifications
              </p>
              <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3">
                <span className="text-sm">Weekly analytics alerts</span>
                <Toggle checked={weeklyNotif} onChange={toggleWeeklyNotif} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 px-4 py-3 mt-2">
                <span className="text-sm">Monthly analytics alerts</span>
                <Toggle checked={monthlyNotif} onChange={toggleMonthlyNotif} />
              </div>
            </div>
          </section>
        </ScrollReveal>

        {/* App behavior */}
        <ScrollReveal once>
          <section className="mt-12">
            <div
              className="rounded-[20px] border p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.06)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground text-center mb-3">
                App behavior
              </p>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("balance:startTutorial", "1");
                  navigate({ to: "/" });
                }}
                className="w-full rounded-xl border border-white/40 px-4 py-3 text-sm text-white"
              >
                Replay tutorial
              </button>
            </div>
          </section>
        </ScrollReveal>

        {/* Danger Zone */}
        <ScrollReveal once>
          <section className="mt-12">
            <div
              className="rounded-[20px] border p-4"
              style={{
                background: "rgba(255,255,255,0.03)",
                borderColor: "rgba(255,255,255,0.06)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground text-center mb-3">
                Danger zone
              </p>
              <button
                onClick={() => setConfirmLogout(true)}
                className="w-full rounded-xl border border-red-500/40 px-4 py-3 text-sm text-red-400"
              >
                Log Out
              </button>
              <button
                onClick={() => setConfirmReset(true)}
                className="w-full rounded-xl border border-red-500/40 px-4 py-3 text-sm text-red-400 mt-2"
              >
                Delete Data
              </button>
            </div>
          </section>
        </ScrollReveal>

        {/* Credits */}
        <ScrollReveal once>
          <section className="mt-16 flex flex-col items-center text-center">
            <img
              src={mackieb}
              alt="An app by Mackie B"
              className="w-48 max-w-[62%] select-none"
              draggable={false}
            />
          </section>
        </ScrollReveal>
      </motion.div>

      <AnimatePresence>
        {customOpen && (
          <CustomThemeSheet
            open={customOpen}
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
              <p className="text-base">Delete all data?</p>
              <p className="mt-2 text-sm text-muted-foreground">
                This permanently deletes all your data from this account's cloud storage and this device. This cannot be undone.
              </p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setConfirmReset(false)} className="flex-1 rounded-xl border border-white/10 py-2 text-sm">Cancel</button>
                <button onClick={resetApp} className="flex-1 rounded-xl bg-red-600 py-2 text-sm text-white">Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {confirmLogout && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-6"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="liquid-glass w-full max-w-sm rounded-3xl p-6"
            >
              <p className="text-base">Log out?</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Since login is required to use Balance, logging out will take you back to setup. Your data stays safe in the cloud and will sync back when you log in again.
              </p>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setConfirmLogout(false)} className="flex-1 rounded-xl border border-white/10 py-2 text-sm">Cancel</button>
                <button onClick={logOut} className="flex-1 rounded-xl bg-red-600 py-2 text-sm text-white">Log Out</button>
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
        {photoViewerOpen && (
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
            <motion.div
              layoutId="avatar-hero"
              transition={{ type: "spring", stiffness: 240, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
              className="grid h-72 w-72 place-items-center overflow-hidden rounded-full border border-white/20 shadow-2xl select-none"
            >
              {avatar ? (
                <img src={avatar} alt="" className="h-full w-full object-cover" draggable={false} />
              ) : (
                <span className="font-mono-display text-5xl">{initials(name || "?")}</span>
              )}
            </motion.div>
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
                disabled={!avatar}
                onClick={() => { setPhotoViewerOpen(false); setConfirmRemovePhoto(true); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-full border border-red-500/40 bg-red-500/15 py-3 text-sm text-red-300 disabled:opacity-30"
              >
                <Trash2 size={15} strokeWidth={1.6} /> Delete
              </button>
            </div>
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
      </AnimatePresence>
    </>
  );
}

function CustomThemeSheet({
  open, theme, onClose, onSave,
}: { open: boolean; theme: ThemeState; onClose: () => void; onSave: (map: Record<string, string>) => void }) {
  useOverlayState(open);
  const [map, setMap] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {};
    for (const c of CATEGORIES) base[c.key] = theme.customMap?.[c.key] ?? getCategory(c.key).color;
    return base;
  });

  const sheet = (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-end bg-black/40 sm:place-items-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, scale: 0.96, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: 40, scale: 0.96, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 32, mass: 0.9 }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        className="flex h-[80vh] max-h-[80vh] min-h-0 w-full max-w-md flex-col overflow-hidden rounded-t-3xl border-t sm:h-auto sm:max-h-[80vh] sm:rounded-3xl sm:border"
        style={{
          background: "rgba(10,10,10,0.97)",
          borderColor: "rgba(255,255,255,0.08)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 -20px 60px -20px rgba(0,0,0,0.8)",
        }}
      >
        <div
          className="flex shrink-0 items-center justify-center pb-4 pt-3"
        >
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>
        <div className="flex shrink-0 items-start justify-between px-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Appearance</p>
            <h2 className="mt-1 font-mono-display text-xl text-foreground/95">Custom theme</h2>
            <p className="mt-1 text-xs text-muted-foreground">Choose a color for each category.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted-foreground" aria-label="Close custom theme">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-5 [touch-action:pan-y]">
          <div className="space-y-2">
            {CATEGORIES.filter((c) => c.key !== "lent_out").map((c) => (
              <label
                key={c.key}
                className="flex items-center gap-3 rounded-2xl border p-3"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderColor: "rgba(255,255,255,0.06)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                }}
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10" style={{ color: map[c.key] }}>
                  <Icon name={c.icon} size={15} strokeWidth={1.5} />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{c.label}</span>
                <span className="h-6 w-6 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: map[c.key] }} />
                <input
                  type="color"
                  value={map[c.key]}
                  aria-label={`${c.label} color`}
                  onChange={(e) => setMap((m) => ({ ...m, [c.key]: e.target.value }))}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded-full border border-white/15 bg-transparent"
                />
              </label>
            ))}
          </div>
        </div>
        <div className="shrink-0 border-t border-white/10 px-5 pb-5 pt-4">
          <button
            onClick={() => onSave(map)}
            className="w-full rounded-xl bg-white py-3 text-sm font-medium text-black"
          >
            Save theme
          </button>
        </div>
      </motion.div>
    </motion.div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(sheet, document.body);
}
