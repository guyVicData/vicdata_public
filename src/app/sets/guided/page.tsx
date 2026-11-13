"use client";

// VicData 0.8 front door, part 2 (D21-D22): the guided sets editor's page.
//   /sets/guided?urn&kind=feeders|compared_against&entry=11+ (Admissions) or &phase=ks4|ks5 (SMT)
//     &product=admissions|smt
//     &set=<id>      a stored set; without it, the school's default set of this kind for the entry point
//                    (else its first), else a new, empty one. &set=new always starts a new one.
//     &from=home     opened from the role's home: Back and Save go back there ("‹ Admissions home")
//     &returnTo=…    else, a page that opens the editor (safeReturnTo), as the round-1 editor
// Read and saved with the member's own session: RLS decides what they may see and change (round 1's
// model and permissions). View as and peeks are read-only, as the round-1 editor says.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { readSets } from "@/lib/sets/store";
import { canCurate, creatorFor, entryOfPhase, setFitsPage, type SetKind } from "@/lib/sets/model";
import { saveModeOf } from "@/lib/sets/editor-state";
import { guidedKindOf, newSetName } from "@/lib/sets/guided";
import { GuidedSetEditor, type GuidedPage, type GuidedStart } from "@/components/sets/GuidedSetEditor";
import { useTeacherTheme } from "@/components/shell/TeacherChrome";
import { accentVars, productAccent } from "@/components/shell/accent";
import { useWidth } from "@/components/admissions/views/charts";
import { fallbackReturn, returnLabel, safeReturnTo } from "@/lib/sets/return-to";
import { leaveEditor } from "@/lib/sets/editor-return";
import { entryPoint } from "@/lib/admissions/entry-points";

const PHONE = 600;

type Membership = { roles: string[] | null; is_admin: boolean | null; admissions_lead: boolean | null; id: string; school_account_id: string; school_accounts: { school_urn: string; account_holder_membership_id: string | null; schools: { current_name: string } | null } };

function GuidedLoader() {
  const sp = useSearchParams();
  const [theme] = useTeacherTheme();
  const [rootRef, width] = useWidth<HTMLDivElement>();
  const urn = sp.get("urn") ?? "";
  const kind: SetKind = sp.get("kind") === "feeders" ? "feeders" : "compared_against";
  const product = sp.get("product") === "smt" && kind === "compared_against" ? "smt" : "admissions";
  const phase = product === "smt" ? (sp.get("phase") === "ks5" ? "ks5" : "ks4") : null;
  const entry = product === "smt" ? (entryOfPhase(phase) ?? "11+") : (sp.get("entry") ?? "11+");
  const setParam = sp.get("set");
  const fromHome = sp.get("from") === "home";
  const asked = safeReturnTo(sp.get("returnTo"));
  const returnTo = fromHome ? "/teacher" : (asked ?? fallbackReturn({ kind, entry, phase, product, urn }));
  const returnFallback = !fromHome && !asked;
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; page: GuidedPage; start: GuidedStart }>({ status: "loading" });

  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data: who } = await supabase.auth.getUser();
      if (!who.user) return setState({ status: "error", message: "Sign in to edit sets." });
      const q = supabase
        .from("school_memberships")
        .select("id, roles, is_admin, admissions_lead, school_account_id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn, account_holder_membership_id, schools(current_name))")
        .eq("profile_id", who.user.id)
        .eq("status", "approved");
      const { data: mems } = await (urn ? q.eq("school_accounts.school_urn", urn) : q).limit(1).returns<Membership[]>();
      const mem = mems?.[0];
      if (!mem) return setState({ status: "error", message: "Sets are edited by the school's own staff. (In View as, sets are read-only.)" });
      const schoolUrn = mem.school_accounts.school_urn;
      const curator = { roles: mem.roles ?? [], isAdmin: !!mem.is_admin, isAccountHolder: mem.school_accounts.account_holder_membership_id === mem.id, lead: !!mem.admissions_lead };
      const curates = canCurate(curator, kind);
      const read = await readSets(supabase, { schoolAccountId: mem.school_account_id, profileId: who.user.id, kind });
      const fit = read.sets.filter((s) => setFitsPage(s, { kind, entryPoint: product === "smt" ? null : entry, phase }));
      const school = fit.filter((s) => s.ownerScope === "school");
      const set = setParam === "new" ? null : setParam ? (read.sets.find((s) => s.id === setParam) ?? null) : (school.find((s) => s.isDefault) ?? school[0] ?? fit[0] ?? null);
      if (setParam && setParam !== "new" && !set) return setState({ status: "error", message: "That set has gone, or isn't one you can see." });
      const g = guidedKindOf(kind, product);
      const mode = saveModeOf(set, { profileId: who.user.id, canCurate: curates });
      const schoolName = mem.school_accounts.schools?.current_name ?? schoolUrn;
      const href = (o: { set?: string | null; entry?: string; phase?: "ks4" | "ks5" }) => {
        const u = new URLSearchParams(sp.toString());
        u.set("urn", schoolUrn);
        if (o.set === undefined) u.delete("set");
        else if (o.set) u.set("set", o.set);
        if (o.entry) u.set("entry", o.entry);
        if (o.phase) u.set("phase", o.phase);
        return `/sets/guided?${u}`;
      };
      // The entry points the school's sets are for (its Admissions entry points, else 11+ and 16+ as its ages allow).
      const { data: eps } = await supabase.from("admissions_entry_points").select("entry_point").eq("school_account_id", mem.school_account_id).order("sort_order");
      const entries = ((eps ?? []) as { entry_point: string }[]).map((e) => e.entry_point);
      const entryChoices =
        product === "smt"
          ? (["ks4", "ks5"] as const).map((p) => ({ label: p === "ks4" ? "GCSE" : "Post-16", href: href({ phase: p }), on: p === phase }))
          : (entries.length ? entries : [entry]).map((e) => ({ label: e, href: href({ entry: e }), on: e === entry }));
      const backLabel = fromHome ? `${product === "smt" ? "SMT" : "Admissions"} home` : returnLabel(returnTo, { kind, entry, phase, product, urn: schoolUrn, schoolName, originSetName: null });
      const page: GuidedPage = {
        urn: schoolUrn,
        schoolName,
        kind,
        g,
        entry,
        entryAge: entryPoint(entry)?.age ?? 11,
        phase,
        entryChoices,
        setChoices: fit.map((s) => ({ label: `${s.name}${s.ownerScope === "personal" ? " (mine)" : ""}`, href: href({ set: s.id }), on: s.id === set?.id })),
        newSetHref: href({ set: "new" }),
        product,
        accentHex: productAccent(product)!.hex,
        returnTo,
        returnFallback,
        returnLabel: backLabel,
        profileId: who.user.id,
        schoolAccountId: mem.school_account_id,
        schoolCreator: creatorFor(curator, kind, product === "smt" ? "smt" : "admissions"),
        readOnly: false,
      };
      const start: GuidedStart = set ? { set, name: set.name, members: set.members, mode } : { set: null, name: newSetName(g), members: [], mode };
      setState({ status: "ready", page, start });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urn, kind, entry, phase, setParam]);

  const accent = useMemo(() => productAccent(product), [product]);
  const phone = width > 0 && width < PHONE;
  return (
    <main id="teacher-root" data-theme={theme} ref={rootRef} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={accentVars(accent)}>
      <div className={phone ? "" : "mx-auto max-w-[1380px] px-7 py-6"}>
        {state.status === "ready" ? (
          <GuidedSetEditor key={`${state.start.set?.id ?? "new"}:${entry}`} page={state.page} start={state.start} phone={phone} />
        ) : (
          <div className={phone ? "px-4 pt-3" : ""}>
            <button type="button" onClick={() => leaveEditor(returnTo, returnFallback)} className={`text-[13px] font-semibold text-[var(--muted2)] ${phone ? "min-h-[44px]" : "min-h-[28px]"}`}>
              ‹ Back
            </button>
            <p className="py-6 text-[13px] text-[var(--muted2)]">{state.status === "loading" ? "Loading…" : state.message}</p>
          </div>
        )}
      </div>
    </main>
  );
}

export default function GuidedSetsPage() {
  return (
    <Suspense fallback={null}>
      <GuidedLoader />
    </Suspense>
  );
}
