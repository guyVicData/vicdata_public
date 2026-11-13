"use client";

// VicData 0.8 front door, part 2 (F26): "Head office sharing" from the account page -- the school's own view
// of its group (SchoolGroupTile, as on the SMT home): whether its SMT has the group dashboards and whether head
// office sees its Admissions panels (the School-Admin's switch). The same component, no new logic.
import Link from "next/link";
import { useEffect, useState } from "react";
import { loadAdminSchool } from "@/components/admin/AdminChrome";
import { AdminShell } from "@/components/school-admin/SchoolAccount";
import { SchoolGroupTile } from "@/components/groups/SchoolGroupTile";

export default function HeadOfficeSharing() {
  const [school, setSchool] = useState<{ urn: string; name: string } | null | "none">(null);
  useEffect(() => {
    void loadAdminSchool().then((s) => setSchool(s.status === "ready" && s.school.canManage ? { urn: s.school.schoolUrn, name: s.school.schoolName } : "none"));
  }, []);
  return (
    <AdminShell school={school && school !== "none" ? school.name : null}>
      {(phone) => (
        <div className={`mx-auto flex max-w-[760px] flex-col gap-3 ${phone ? "px-4 py-4" : "px-6 py-10"}`}>
          <Link href="/teacher/school-account" className="inline-flex min-h-[44px] items-center self-start text-[13.5px] text-[var(--muted2)] hover:text-[var(--fg)]">
            ‹ {school && school !== "none" ? `${school.name}’s account` : "Your school’s account"}
          </Link>
          <h1 className={`font-bold ${phone ? "text-[24px]" : "text-[30px]"}`}>Head office sharing</h1>
          {school === null ? <p className="text-[13.5px] text-[var(--muted2)]">Loading…</p> : school === "none" ? <p className="text-[13.5px] text-[var(--muted2)]">Head office sharing is set by your School-Admin.</p> : <SchoolGroupTile urn={school.urn} />}
        </div>
      )}
    </AdminShell>
  );
}
