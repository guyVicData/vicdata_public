"use client";

import { useEffect, useState } from "react";

// 0.8 front door part 3 (E24, R-DEVICE-CAP): the one-line notice on the page after a sign-in that signed another
// device out ("You can be signed in on 3 devices at once, so we signed you out on Chrome on Mac."). The server
// leaves it in a short-lived cookie. Sign-in lands on /member, which forwards to /teacher with a full load, so the
// notice is moved into this tab's sessionStorage at once and shown from there until it is dismissed or has been on
// screen for SHOWN_MS (found by hand: read and cleared on /member, it was gone before any page showed it).
const NAME = "vicdata_notice";
const KEY = "vicdata.signInNotice";
const SHOWN_MS = 12_000;

function take(): string | null {
  const raw = document.cookie.split("; ").find((c) => c.startsWith(`${NAME}=`));
  if (raw) {
    document.cookie = `${NAME}=; path=/; max-age=0`;
    let words = raw.slice(NAME.length + 1);
    try {
      words = decodeURIComponent(words);
    } catch {
      // Shown as it came.
    }
    try {
      sessionStorage.setItem(KEY, words);
    } catch {
      return words;
    }
  }
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function forget() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing kept.
  }
}

export function SignInNotice() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const words = take();
      if (!words) return;
      setText(words);
      timer = setTimeout(forget, SHOWN_MS);
    })();
    return () => clearTimeout(timer);
  }, []);
  if (!text) return null;
  return (
    <div role="status" className="flex items-center justify-between gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:bg-amber-900/60 dark:text-amber-50">
      <span>{text}</span>
      <button
        type="button"
        onClick={() => {
          forget();
          setText(null);
        }}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-amber-950 dark:text-amber-50"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
