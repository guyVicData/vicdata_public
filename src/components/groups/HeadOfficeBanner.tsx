"use client";

// VicData 0.8 groups r1 (G2): the strip over a member school's SMT dashboards when head office opens
// them -- read-only, and the way back to the group's home.
import Link from "next/link";
import { useEffect, useState } from "react";
import { backFrom } from "@/lib/front-door/back";
import { GROUP_ACCENT, GROUP_BRONZE } from "@/lib/teacher-view-theme";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";

export function HeadOfficeBanner({ note, className = "" }: { note: string; className?: string }) {
  const [theme] = useTeacherTheme();
  // 20 Nov: back to the group head office came from (?back=, with its account), else the group home.
  const [back, setBack] = useState("/teacher/group");
  useEffect(() => {
    const b = backFrom(window.location.search, "/teacher/group");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (b.given && b.href.startsWith("/teacher/group")) setBack(b.href);
  }, []);
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border px-3 py-2 text-[12.5px] font-semibold ${className}`}
      style={{ borderColor: `rgba(${GROUP_ACCENT.rgb}, 0.45)`, background: `rgba(${GROUP_ACCENT.rgb}, 0.10)`, color: "var(--fg)" }}
    >
      <span>{note}</span>
      <span className="flex-grow" />
      <Link href={back} className="font-bold" style={{ color: theme === "dark" ? GROUP_ACCENT.hex : GROUP_BRONZE.light.accentText }}>
        Back to the group &rarr;
      </Link>
    </div>
  );
}
