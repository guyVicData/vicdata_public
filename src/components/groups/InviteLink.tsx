"use client";

// VicData 0.8 groups r1: an invitation's one-time link, shown once to the inviter to send on (VicData
// sends no email). The token is never stored in the clear, so it can't be shown again: invite again for
// a new link (the old one stops working).
import { useState } from "react";

export const inviteLink = (token: string) => `${typeof window === "undefined" ? "" : window.location.origin}/teacher/group/join?invite=${token}`;

export function InviteLink({ email, url }: { email: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-[var(--panel-border2)] bg-[var(--box-bg)] p-3 text-[12px]" data-invite-link="">
      <span className="font-bold">Invitation link for {email}: send it to them. It is shown only now.</span>
      <span className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 break-all text-[11.5px] text-[var(--muted2)]">{url}</code>
        <button
          type="button"
          className="font-bold underline-offset-2 hover:underline"
          onClick={() => {
            void navigator.clipboard?.writeText(url).then(() => setCopied(true));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </span>
    </div>
  );
}
