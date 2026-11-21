"use client";

import { useEffect, useState } from "react";

// 0.8 front door part 3 (E24, R-DEVICE-CAP): the one-line notice on the page after a sign-in that signed another
// device out ("You can be signed in on 3 devices at once, so we signed you out on Chrome on Mac."). The server
// leaves it in a short-lived cookie; this shows it once and clears it.
const NAME = "vicdata_notice";

export function SignInNotice() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    (async () => {
      const raw = document.cookie.split("; ").find((c) => c.startsWith(`${NAME}=`));
      if (!raw) return;
      document.cookie = `${NAME}=; path=/; max-age=0`;
      const value = raw.slice(NAME.length + 1);
      let words = value;
      try {
        words = decodeURIComponent(value);
      } catch {
        // Shown as it came.
      }
      setText(words);
    })();
  }, []);
  if (!text) return null;
  return (
    <div role="status" className="flex items-center justify-between gap-3 bg-amber-100 px-4 py-2 text-sm text-amber-950 dark:bg-amber-900/60 dark:text-amber-50">
      <span>{text}</span>
      <button type="button" onClick={() => setText(null)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded text-amber-950 dark:text-amber-50" aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
