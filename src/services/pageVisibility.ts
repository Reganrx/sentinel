import { useSyncExternalStore } from "react";
import type { NavigationView } from "../navigation/NavigationContext";

const STORAGE_KEY = "sentinel-visible-pages";
const CHANGE_EVENT = "sentinel:visible-pages-changed";
const ALWAYS_VISIBLE = new Set<NavigationView>(["home", "settings"]);

export function getHiddenPages(): NavigationView[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value)
      ? value.filter(item => typeof item === "string") as NavigationView[]
      : [];
  } catch {
    return [];
  }
}

export function isPageVisible(page: NavigationView) {
  return ALWAYS_VISIBLE.has(page) || !getHiddenPages().includes(page);
}

export function setPageVisible(page: NavigationView, visible: boolean) {
  if (ALWAYS_VISIBLE.has(page)) return;
  const hidden = new Set(getHiddenPages());
  if (visible) hidden.delete(page);
  else hidden.add(page);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...hidden]));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

let cachedRaw: string | null = null;
let cachedHidden: NavigationView[] = [];
function snapshot() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedHidden = getHiddenPages();
  }
  return cachedHidden;
}

export function useHiddenPages() {
  return useSyncExternalStore(subscribe, snapshot, () => [] as NavigationView[]);
}
