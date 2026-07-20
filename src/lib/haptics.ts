// Tiny haptic vocabulary using the Web Vibration API. Best-effort: silently
// no-ops on platforms where it isn't supported (notably iOS Safari).

type Pattern = "tick" | "soft" | "medium" | "success" | "warning" | "thud" | "heavy";

const patterns: Record<Pattern, number | number[]> = {
  tick: 8,
  soft: 12,
  medium: 25,
  success: [10, 30, 20],
  warning: [25, 60, 25],
  thud: 60,
  heavy: [40, 20, 40],
};

export function haptic(p: Pattern) {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try { navigator.vibrate(patterns[p]); } catch { /* ignore */ }
}
