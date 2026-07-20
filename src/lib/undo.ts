let pending: { id: string; label: string; onUndo: (() => void) | null; expiresAt: number } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function showUndo(label: string, onUndo: () => void, ms = 3000) {
  if (timer) clearTimeout(timer);
  pending = { id: crypto.randomUUID(), label, onUndo, expiresAt: Date.now() + ms };
  timer = setTimeout(() => {
    pending = null;
    timer = null;
    emit();
  }, ms);
  emit();
}

/** Toast with no undo action — same look and duration as showUndo. */
export function showInfo(label: string, ms = 3000) {
  if (timer) clearTimeout(timer);
  pending = { id: crypto.randomUUID(), label, onUndo: null, expiresAt: Date.now() + ms };
  timer = setTimeout(() => {
    pending = null;
    timer = null;
    emit();
  }, ms);
  emit();
}

export function performUndo() {
  if (!pending || !pending.onUndo) return;
  const p = pending;
  pending = null;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  emit();
  p.onUndo?.();
}

export function dismissUndo() {
  if (timer) clearTimeout(timer);
  pending = null;
  timer = null;
  emit();
}

export function subscribeUndo(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getUndo() {
  return pending;
}
