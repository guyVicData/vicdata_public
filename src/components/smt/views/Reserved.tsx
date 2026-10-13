"use client";

// VicData 0.8 SMT r1: a reserved panel -- the slot exists, the data doesn't yet (Results by band,
// roadmap step 4). R-SMT-VIEW-RESERVED.
import { SMT_NOTES } from "@/catalogue/notes";

export function ReservedPanel({ title }: { title: string }) {
  return (
    <>
      <div className="text-[12.5px] font-bold text-[var(--fg)]">{title}</div>
      <div data-reserved="" className="flex grow items-center justify-center rounded-[9px] border border-dashed border-[var(--panel-border2)] p-4 text-center text-[12px] leading-snug text-[var(--muted2)]">
        {SMT_NOTES.bandReserved}
      </div>
    </>
  );
}
