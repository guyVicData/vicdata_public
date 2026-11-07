"use client";

// VicData 0.8 sets round 1 (C12-C17, D20): the set editor's page.
//   /sets/edit?urn&kind=compared_against|feeders&entry=11+ (or &phase=ks4|ks5)
//     &set=<id>                      edit a stored set (a copy if you can't change it)
//     &urns=1,2,3&name=…&from=<key>  a copy of a default set (or any set) to save as your own
//     (neither)                      New set…: empty, for this page's kind and entry point
//     &back=<path>                   where Save goes back to, with the set in use (useSet=<id>)
//     &product=admissions|smt|teacher&used=<sentence>  the accent, and "Where this set is used"
// Everything is read and saved with the member's own session: RLS decides what they may see and change.
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { readSet, readSets } from "@/lib/sets/store";
import { activePersonalCount, canCurate, creatorFor, entryOfPhase, type CreatorKind, type SetKind } from "@/lib/sets/model";
import { saveModeOf } from "@/lib/sets/editor-state";
import { SetEditor, type EditorPage, type EditorStart } from "@/components/sets/SetEditor";
import { useTeacherTheme } from "@/components/shell/TeacherChrome";
import { accentVars, productAccent } from "@/components/shell/accent";
import { useWidth } from "@/components/admissions/views/charts";
import { safeReturnTo } from "@/lib/sets/return-to";

const PHONE = 600;

type Membership = { roles: string[] | null; is_admin: boolean | null; admissions_lead: boolean | null; id: string; school_account_id: string; school_accounts: { school_urn: string; account_holder_membership_id: string | null; schools: { current_name: string } | null } };

function EditorLoader() {
  const sp = useSearchParams();
  const [theme] = useTeacherTheme();
  const [rootRef, width] = useWidth<HTMLDivElement>();
  const urn = sp.get("urn") ?? "";
  const kind: SetKind = sp.get("kind") === "feeders" ? "feeders" : "compared_against";
  const phase = sp.get("phase") === "ks4" || sp.get("phase") === "ks5" ? (sp.get("phase") as "ks4" | "ks5") : null;
  const entry = sp.get("entry") ?? entryOfPhase(phase) ?? "11+";
  const setId = sp.get("set");
  const product = sp.get("product") === "smt" ? "smt" : sp.get("product") === "teacher" ? "teacher" : "admissions";
  // Only a path on this site, on a page that opens the editor (an open redirect, and javascript: URLs, otherwise).
  const back = safeReturnTo(sp.get("back")) ?? "/sets";
  const [state, setState] = useState<{ status: "loading" } | { status: "error"; message: string } | { status: "ready"; page: EditorPage; start: EditorStart }>({ status: "loading" });

  useEffect(() => {
    (async () => {
      const supabase = createBrowserSupabaseClient();
      const { data: who } = await supabase.auth.getUser();
      if (!who.user) return setState({ status: "error", message: "Sign in to edit sets." });
      const { data: mem } = await supabase
        .from("school_memberships")
        .select("id, roles, is_admin, admissions_lead, school_account_id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn, account_holder_membership_id, schools(current_name))")
        .eq("profile_id", who.user.id)
        .eq("status", "approved")
        .eq("school_accounts.school_urn", urn)
        .limit(1)
        .maybeSingle<Membership>();
      if (!mem) return setState({ status: "error", message: "Sets are edited by the school's own staff. (In View as, sets are read-only.)" });
      const curator = { roles: mem.roles ?? [], isAdmin: !!mem.is_admin, isAccountHolder: mem.school_accounts.account_holder_membership_id === mem.id, lead: !!mem.admissions_lead };
      const curates = canCurate(curator, kind);
      const set = setId ? await readSet(supabase, setId) : null;
      if (setId && !set) return setState({ status: "error", message: "That set has gone, or isn't one you can see." });
      const personal = await readSets(supabase, { schoolAccountId: null, profileId: who.user.id });
      let lastChanged: string | null = null;
      if (set?.updatedBy) {
        const { data: p } = await supabase.from("profiles").select("full_name, email").eq("id", set.updatedBy).maybeSingle<{ full_name: string | null; email: string | null }>();
        const when = new Date(set.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
        lastChanged = `${p?.full_name || p?.email || "a colleague"}, ${when}`;
      }
      const fromKey = sp.get("from");
      const isDefault = !set && !!fromKey;
      const mode = saveModeOf(set, { profileId: who.user.id, canCurate: curates, isDefault });
      const creator: CreatorKind = set ? set.creatorKind : isDefault ? "default" : "me";
      const editableBy = kind === "feeders" ? "the Admissions lead (and the School-Admin, audited)" : "the Admissions lead, SMT and the School-Admin";
      const schoolName = mem.school_accounts.schools?.current_name ?? urn;
      const urns = (sp.get("urns") ?? "").split(",").filter((u) => /^\d{5,7}$/.test(u));
      const start: EditorStart = set
        ? { set, name: set.name, description: set.description, members: set.members, creator, sourceRecipe: set.sourceRecipe, mode, editableBy: set.ownerScope === "personal" ? "you" : editableBy, lastChanged }
        : { set: null, name: sp.get("name") || (kind === "feeders" ? "New feeder set" : "New set"), description: null, members: urns.map((u) => ({ urn: u })), creator, sourceRecipe: fromKey, mode, editableBy: "you, once saved", lastChanged: null };
      const { data: traits } = await supabase.from("schools").select("boarders_name").eq("urn", urn).maybeSingle<{ boarders_name: string | null }>();
      const page: EditorPage = {
        urn,
        schoolName,
        kind,
        entry,
        phase,
        back,
        usedOn: sp.get("used") || (kind === "feeders" ? `Pipelines at ${entry} for Admissions. Not shown in Teacher.` : `Market share at ${entry}${phase ? "" : ""}; teachers see ${entry === "11+" ? "it on GCSE pages" : entry === "16+" ? "it on Post-16 pages" : "it nowhere"} under School sets when it is a school set.`),
        profileId: who.user.id,
        schoolAccountId: mem.school_account_id,
        schoolCreator: creatorFor(curator, kind, product === "smt" ? "smt" : "admissions"),
        personalActive: activePersonalCount(personal.sets, who.user.id),
        boardingSchool: /boarding school/i.test(traits?.boarders_name ?? ""),
        readOnly: false,
      };
      setState({ status: "ready", page, start });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urn, kind, entry, setId]);

  const accent = useMemo(() => productAccent(product === "teacher" ? "teacher" : product, product === "teacher" ? (phase === "ks5" ? "ks5" : "ks4") : undefined), [product, phase]);
  const phone = width > 0 && width < PHONE;
  return (
    <main id="teacher-root" data-theme={theme} ref={rootRef} className="min-h-screen bg-[var(--bg)] text-[var(--fg)]" style={accentVars(accent)}>
      <div className={phone ? "" : "mx-auto max-w-[1180px] px-7 py-5"}>
        {!phone && (
          <nav className="mb-3 text-[12px] text-[var(--muted2)]" aria-label="Breadcrumb">
            <a href={back} className="hover:underline">Back</a> › {kind === "feeders" ? "Feeder schools" : "Compared against"} › {setId ? "Edit set" : "New set"}
          </nav>
        )}
        {state.status === "loading" ? (
          <p className="p-6 text-[13px] text-[var(--muted2)]">Loading…</p>
        ) : state.status === "error" ? (
          <p className="p-6 text-[13px] text-[var(--muted2)]">{state.message}</p>
        ) : (
          <SetEditor page={state.page} start={state.start} phone={phone} />
        )}
      </div>
    </main>
  );
}

export default function SetEditPage() {
  return (
    <Suspense fallback={null}>
      <EditorLoader />
    </Suspense>
  );
}
