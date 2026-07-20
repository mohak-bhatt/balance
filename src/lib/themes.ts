// Category color theme system. Themes override the per-category colors from
// ledger.ts. The active theme is persisted to localStorage and broadcast via
// a small pub/sub so any consumer that subscribes re-renders live.

import { CATEGORIES, getCategory } from "./ledger";

export type ThemeId = "greyscale" | "vibrant" | "pastel" | "ocean" | "sunset" | "custom";

export interface ThemeState {
  id: ThemeId;
  customMap?: Record<string, string>;
}

const STORAGE_KEY = "balance:theme";

export const THEME_META: { id: ThemeId; label: string }[] = [
  { id: "greyscale", label: "Greyscale" },
  { id: "vibrant", label: "Vibrant" },
  { id: "pastel", label: "Pastel" },
  { id: "ocean", label: "Ocean" },
  { id: "sunset", label: "Sunset" },
];

// Stable index per category so generated palettes are deterministic.
const CAT_INDEX: Record<string, number> = Object.fromEntries(
  CATEGORIES.map((c, i) => [c.key, i]),
);

function hsl(h: number, s: number, l: number) {
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

function generated(themeId: ThemeId, key: string): string {
  const i = CAT_INDEX[key] ?? 0;
  const n = CATEGORIES.length || 1;
  const t = i / n;
  switch (themeId) {
    case "greyscale": {
      // Spread across 8 distinct grey shades
      const l = 30 + ((i * 53) % 60); // 30–89
      return hsl(0, 0, l);
    }
    case "pastel":
      return hsl(t * 360, 55, 78);
    case "ocean":
      return hsl(180 + t * 80, 60, 50 + (i % 5) * 4);
    case "sunset":
      return hsl(t * 70, 75, 55 + (i % 5) * 3); // 0..70 = red→yellow
    case "vibrant":
    default:
      return getCategory(key).color;
  }
}

export function loadTheme(): ThemeState {
  if (typeof window === "undefined") return { id: "greyscale" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { id: "greyscale" };
    return JSON.parse(raw) as ThemeState;
  } catch {
    return { id: "greyscale" };
  }
}

const listeners = new Set<() => void>();
export function subscribeTheme(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function saveTheme(t: ThemeState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  listeners.forEach((fn) => fn());
}

export function colorFor(theme: ThemeState, categoryKey: string): string {
  if (theme.id === "custom" && theme.customMap?.[categoryKey]) {
    return theme.customMap[categoryKey];
  }
  if (theme.id === "custom") return getCategory(categoryKey).color;
  return generated(theme.id, categoryKey);
}

import { useEffect, useState } from "react";

export function useTheme(): [ThemeState, (t: ThemeState) => void] {
  const [t, setT] = useState<ThemeState>(() => loadTheme());
  useEffect(() => {
    const unsub = subscribeTheme(() => setT(loadTheme()));
    return () => { unsub(); };
  }, []);
  return [t, (next) => { saveTheme(next); setT(next); }];
}

export function useCategoryColor() {
  const [t] = useTheme();
  return (key: string) => colorFor(t, key);
}
