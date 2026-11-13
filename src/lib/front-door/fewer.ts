"use client";
// VicData 0.8 front door (B10): "Hide walkthroughs" shrinks, never removes. One switch, remembered per
// person in this browser (like the theme): on home, "Show fewer questions"; in the account menu, the same
// toggle. With it on, "Open the full dashboard" becomes each section's big button and its questions drop
// to one line of text links beneath it. Same page shape for everyone.
import { useSyncExternalStore } from "react";

const KEY = "vicdata.home.fewer";
let fewer: boolean | null = null;
const listeners = new Set<() => void>();
function read(): boolean {
  if (fewer !== null) return fewer;
  fewer = false;
  try {
    fewer = window.localStorage.getItem(KEY) === "1";
  } catch {
    // Blocked storage: the full questions, for this visit.
  }
  return fewer;
}
export function setFewerQuestions(on: boolean) {
  fewer = on;
  try {
    window.localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Remembered for this visit only.
  }
  for (const l of listeners) l();
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useFewerQuestions(): [boolean, (on: boolean) => void] {
  return [useSyncExternalStore(subscribe, read, () => false), setFewerQuestions];
}
