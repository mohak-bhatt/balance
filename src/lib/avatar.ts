// Tiny IndexedDB wrapper to persist the user's avatar without bloating
// localStorage. Single key, single record.

const DB = "balance";
const STORE = "media";
const KEY = "avatar";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveAvatar(blob: Blob): Promise<void> {
  const db = await open();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, KEY);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function loadAvatar(): Promise<string | null> {
  if (typeof indexedDB === "undefined") return null;
  try {
    const db = await open();
    const blob = await new Promise<Blob | null>((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => res(req.result ?? null);
      req.onerror = () => rej(req.error);
    });
    if (!blob) return null;
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export async function clearAvatar(): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((res) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => res();
      tx.onerror = () => res();
    });
  } catch { /* ignore */ }
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

import { useEffect, useState } from "react";

/** Reactive avatar URL. Reloads from IndexedDB on mount. */
export function useAvatar(): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadAvatar().then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, []);
  return url;
}
