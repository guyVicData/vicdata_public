"use client";

// VicData 0.8 groups r1 (G2): the strip over a member school's SMT dashboards when head office opens
// them -- read-only, and the way back to the group's home.
import Link from "next/link";
import { GROUP_ACCENT } from "@/lib/teacher-view-theme";
import { useTeacherTheme } from "@/components/teacher/TeacherChrome";

export function HeadOfficeBanner({ note, className = "" }: { note: string; className?: string }) {
  const [theme] = useTeacherTheme();
  return (
    <div
      role="status"
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] border px-3 py-2 text-[12.5px] font-semibold ${className}`}
      style={{ borderColor: `rgba(${GROUP_ACCENT.rgb}, 0.45)`, background: `rgba(${GROUP_ACCENT.rgb}, 0.10)`, color: "var(--fg)" }}
    >
      <span>{note}</span>
      <span className="flex-grow" />
      <Link href="/teacher/group" className="font-bold" style={{ color: theme === "dark" ? GROUP_ACCENT.hex : "#c2410c" }}>
        Back to the group &rarr;
      </Link>
    </div>
  );
}
