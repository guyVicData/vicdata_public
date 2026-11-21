// 0.8 front door part 3 (F27, E24): the School-Admin's "Sign-ins and devices", pure. Each of the school's staff with
// the devices they're signed in on now, last active, and a flag when their account was used from more than
// PLACES_ALERT.places places in PLACES_ALERT.hours hours; flagged people first, then the most recently active.
import { PLACES_ALERT } from "../devices/config";

export type StaffRow = { profileId: string; membershipId: string; name: string; email: string | null };
export type DeviceLite = { profile_id: string; label: string; form: string | null; place: string | null; signed_in_at: string | null; signed_out_at: string | null; last_active_at: string };
export type EventLite = { profile_id: string; place: string | null; at: string };

export type SigninPerson = StaffRow & { devices: { label: string; form: string | null; place: string | null; lastActiveAt: string }[]; lastActiveAt: string | null; flaggedPlaces: string[] | null };
export type SigninsView = { people: SigninPerson[]; devices: number; flags: number };

/** People and counts for the page, and the account row's summary. */
export function signinsView(staff: StaffRow[], devices: DeviceLite[], events: EventLite[], now: Date): SigninsView {
  const since = now.getTime() - PLACES_ALERT.hours * 3_600_000;
  const people = staff.map((s): SigninPerson => {
    const mine = devices.filter((d) => d.profile_id === s.profileId && d.signed_in_at && !d.signed_out_at).sort((a, b) => b.last_active_at.localeCompare(a.last_active_at));
    const places = new Set(events.filter((e) => e.profile_id === s.profileId && e.place && new Date(e.at).getTime() >= since).map((e) => e.place!));
    return {
      ...s,
      devices: mine.map((d) => ({ label: d.label, form: d.form, place: d.place, lastActiveAt: d.last_active_at })),
      lastActiveAt: mine[0]?.last_active_at ?? null,
      flaggedPlaces: places.size > PLACES_ALERT.places ? [...places].sort() : null,
    };
  });
  people.sort((a, b) => Number(!!b.flaggedPlaces) - Number(!!a.flaggedPlaces) || (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "") || a.name.localeCompare(b.name));
  return { people, devices: people.reduce((n, p) => n + p.devices.length, 0), flags: people.filter((p) => p.flaggedPlaces).length };
}

/** The account page row's words: "58 devices · 1 flag", and its badge ("1 flag") when anyone is flagged. */
export function signinsRow(s: { devices: number; flags: number } | null): { summary: string; badge: string | null } {
  if (!s) return { summary: "Not set up yet", badge: null };
  const flags = s.flags ? ` · ${s.flags} ${s.flags === 1 ? "flag" : "flags"}` : "";
  return { summary: `${s.devices} ${s.devices === 1 ? "device" : "devices"}${flags}`, badge: s.flags ? `${s.flags} ${s.flags === 1 ? "flag" : "flags"}` : null };
}
