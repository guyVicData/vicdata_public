// Run: node --import tsx --test src/lib/sign-in-words.test.ts
// R-SIGN-IN-WORDS (review pack 22 Nov, issue 7): users read "Sign in" and "Sign out", never "Log in", "Log Out" or
// "logged in"; the three password screens (Forgot, Reset, an expired link) share the one AuthShell frame.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(__dirname, "..");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    return /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
/** The code without its comments (line, block and JSX comments). */
const code = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

test("R-SIGN-IN-WORDS: no 'Log in', 'Log out' or 'logged in' anywhere users read", () => {
  const bad: string[] = [];
  for (const f of [...files(path.join(ROOT, "app")), ...files(path.join(ROOT, "components"))]) {
    const lines = code(readFileSync(f, "utf8")).split("\n");
    lines.forEach((l, i) => {
      if (/\b(Log [Ii]n|Log ?[Oo]ut|LogIn|Logging (in|out)|[Ll]ogged (in|out)|log (in|out)|your login)\b/.test(l)) bad.push(`${path.relative(ROOT, f)}:${i + 1}: ${l.trim()}`);
    });
  }
  assert.deepEqual(bad, []);
  const nav = readFileSync(path.join(ROOT, "components/shell/TeacherNav.tsx"), "utf8");
  assert.match(nav, /"Signing out…" : "Sign out"/);
  assert.match(nav, />Sign in<\/Link>/);
});

test("R-SIGN-IN-WORDS: Forgot, Reset and the expired link are one frame (AuthShell), each back to 'sign in'", () => {
  const login = readFileSync(path.join(ROOT, "app/login/page.tsx"), "utf8");
  const reset = readFileSync(path.join(ROOT, "app/reset-password/page.tsx"), "utf8");
  const forgot = readFileSync(path.join(ROOT, "components/auth/ForgotPasswordForm.tsx"), "utf8");
  assert.match(login, /<AuthShell/);
  assert.match(login, /ForgotPasswordForm/, "Forgot is drawn inside the sign-in page's AuthShell");
  assert.match(reset, /<AuthShell/, "Reset (and the expired link it lands on) is AuthShell too");
  assert.equal((reset.match(/return \(\s*</g) ?? []).length, 1, "one frame for every reset state");
  for (const s of [reset, forgot]) assert.match(s, /Back to sign in/);
  // /auth/confirm sends a recovery link (or its error) to /reset-password: no screen of its own.
  assert.match(readFileSync(path.join(ROOT, "app/auth/confirm/route.ts"), "utf8"), /reset-password/);
});
