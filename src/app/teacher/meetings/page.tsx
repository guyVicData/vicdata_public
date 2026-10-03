// Teacher view Meetings, VicData 0.6 S7: the meetings list (MeetingsArchive.dc.html).
//
// Replaces the round-5 page (one long list of decks built from the old axis catalogue).
// Meetings are now presentation dashboards (kind "presentation" in the S2 tables); the
// old `meetings` / `meeting_slides` tables stay in place, read-only, and the migration
// 20261104110000_v06_s7_meetings_migration.sql moves their rows across.
import { MeetingsLibrary } from "@/components/meetings/MeetingsLibrary";

export default function MeetingsPage() {
  return <MeetingsLibrary />;
}
