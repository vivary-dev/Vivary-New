import { useEffect, useState, type ComponentProps, type RefObject } from "react";
import { ResizablePanel } from "@agent-native/toolkit/ui";

export type PanelHandle = Extract<ComponentProps<typeof ResizablePanel>["panelRef"], RefObject<unknown>>["current"];

export function useNarrowLayout() {
  const [narrow, setNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

export function readPanelWidth(key: string, fallback: number, min: number, max: number) {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  } catch { return fallback; }
}

export function savePanelWidth(key: string, width: number) {
  try { window.localStorage.setItem(key, String(Math.round(width))); } catch { /* Layout still works without browser storage. */ }
}
