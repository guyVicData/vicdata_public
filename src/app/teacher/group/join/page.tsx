"use client";

// VicData 0.8 groups r1: accepting a head-office invitation -- an explicit act, with the link's one-time
// token, by the account whose address was invited (group_accept_invitation checks both). Nothing is
// accepted by visiting any other page.
import Link from "next/link";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";
import { groupVars } from "@/components/groups/ui";

export default function GroupJoinPage() {
  const [theme] = useTeacherTheme();
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  async function accept() {
    const token = new URLSearchParams(window.location.search).get("invite") ?? "";
    setState("busy");
    const supabase = createBrowserSupabaseClient();
    const { data: s } = await supabase.auth.getSession();
    if (!s.session) {
      setState("error");
      setMessage("Sign in with the address you were invited at, then open the link again.");
      return;
    }
    const { error } = await supabase.rpc("group_accept_invitation", { p_token: token });
    if (error) {
      setState("error");
      setMessage("This invitation link isn’t valid for your account. It works once, only for the address it was sent to; ask head office for a new one.");
      return;
    }
    window.location.replace(`${window.location.origin}/teacher/group`);
  }
  return (
    <main id="teacher-root" data-theme={theme} className="mx-auto min-h-screen max-w-xl bg-[var(--bg)] p-6 text-[var(--fg)]" style={groupVars(theme)}>
      <h1 className="text-[20px] font-bold">Join your group&rsquo;s head office on VicData</h1>
      <p className="mt-2 text-[13px] text-[var(--muted2)]">You&rsquo;ve been invited to a group&rsquo;s head office. Accept to see the group&rsquo;s home and its schools.</p>
      <button type="button" disabled={state === "busy"} onClick={accept} className="mt-4 rounded-[8px] px-4 py-2 text-[13px] font-bold disabled:opacity-60" style={{ background: "var(--group-switch-on)", color: "#1f0f04" }}>
        {state === "busy" ? "Accepting…" : "Accept the invitation"}
      </button>
      {message && <p role="alert" className="mt-3 text-[12.5px] text-[var(--muted2)]">{message}</p>}
      <p className="mt-6 text-[12px]">
        <Link href="/login?next=/teacher/group" className="font-bold text-[var(--group-accent-text)]">Sign in</Link> first if you aren&rsquo;t.
      </p>
    </main>
  );
}
