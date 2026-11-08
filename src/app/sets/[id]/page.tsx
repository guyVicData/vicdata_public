"use client";

// VicData 0.8 sets round 1 (D19): a set, read-only (src/components/sets/SetView.tsx).
//   /sets/<id>?urn                         a stored set (RLS: the reader's own session)
//   /sets/default?urn&kind&entry&from&name&urns   a default set, from its schools (computed, never stored)
// It replaces the old comparator set page (roll ranks and trends), which read the old tables.
import { returnToHere, savedSetFromEditor, useEditorReturnReload } from "@/lib/sets/editor-return";
import { Suspense, use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import { readSet } from "@/lib/sets/store";
import { canCurate, type SetKind } from "@/lib/sets/model";
import { SetView, type ViewedSet } from "@/components/sets/SetView";
import { SetsShell, SetsWayBack, useSetsMember, wayBack } from "@/components/sets/SetsShell";

function View({ id }: { id: string }) {
  const sp = useSearchParams();
  const [viewed, setViewed] = useState<ViewedSet | null | "error">(null);
  const [urnFromSet, setUrnFromSet] = useState<string | null>(sp.get("urn"));
  const m = useSetsMember(urnFromSet);
  // Back from editing this set: the page reads it afresh (a reload if the browser restored it from its
  // cache), and the handover is taken so it doesn't linger.
  useEditorReturnReload();
  useState(() => savedSetFromEditor());
  useEffect(() => {
    (async () => {
      if (id === "default") {
        const kind: SetKind = sp.get("kind") === "feeders" ? "feeders" : "compared_against";
        const urns = (sp.get("urns") ?? "").split(",").filter((u) => /^\d{5,7}$/.test(u));
        setViewed({ id: null, key: sp.get("from") ?? "default:", name: sp.get("name") ?? "Default set", description: null, kind, entry: sp.get("entry") ?? "11+", phase: null, creator: "default", scope: "default", pinned: false, members: urns.map((u) => ({ urn: u, tier: null })), lastChanged: null, canChange: false });
        return;
      }
      const supabase = createBrowserSupabaseClient();
      const s = await readSet(supabase, id);
      if (!s) return setViewed("error");
      if (!urnFromSet && s.focusUrn) setUrnFromSet(s.focusUrn);
      const { data: who } = await supabase.auth.getUser();
      let canChange = s.ownerScope === "personal" && s.ownerProfileId === who.user?.id;
      if (s.ownerScope === "school" && who.user && s.schoolAccountId) {
        const { data: mem } = await supabase.from("school_memberships").select("id, roles, is_admin, admissions_lead, school_accounts!school_memberships_school_account_id_fkey!inner(account_holder_membership_id)").eq("profile_id", who.user.id).eq("status", "approved").eq("school_account_id", s.schoolAccountId).limit(1).maybeSingle<{ id: string; roles: string[] | null; is_admin: boolean | null; admissions_lead: boolean | null; school_accounts: { account_holder_membership_id: string | null } }>();
        canChange = !!mem && canCurate({ roles: mem.roles ?? [], isAdmin: !!mem.is_admin, isAccountHolder: mem.school_accounts.account_holder_membership_id === mem.id, lead: !!mem.admissions_lead }, s.kind);
      }
      let lastChanged: string | null = null;
      if (s.updatedBy) {
        const { data: p } = await supabase.from("profiles").select("full_name, email").eq("id", s.updatedBy).maybeSingle<{ full_name: string | null; email: string | null }>();
        lastChanged = `${p?.full_name || p?.email || "a colleague"}, ${new Date(s.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
      }
      setViewed({ id: s.id, key: `set:${s.id}`, name: s.name, description: s.description, kind: s.kind, entry: s.entryPoint ?? (s.phase === "ks5" ? "16+" : "11+"), phase: s.phase, creator: s.creatorKind, scope: s.ownerScope, pinned: s.pinned, members: s.members.map((x) => ({ urn: x.urn, tier: x.tier })), lastChanged, canChange });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  // The way back: the dashboard the library (or a set menu) was opened from, with this set when it's the
  // kind that page uses; else the school's dashboard for the person's role. Never a page without one.
  const back = wayBack(sp.get("returnTo"), m.status === "ready" ? m.member : null);
  const keepBack = back.fallback ? "" : `&${new URLSearchParams({ returnTo: back.returnTo })}`;
  return (
    <SetsShell>
      {(phone) => {
        const holding = (words: string) => (
          <div className={`flex flex-col ${phone ? "px-4 pt-2" : ""}`}>
            <SetsWayBack back={back} phone={phone} />
            <p className={`${phone ? "py-4" : "py-6"} text-[13px] text-[var(--muted2)]`}>{words}</p>
          </div>
        );
        if (viewed === "error") return holding("That set has gone, or isn’t one you can see.");
        if (m.status === "error") return holding(m.message);
        if (!viewed || m.status !== "ready") return holding("Loading…");
        const urn = m.member.urn;
        // The editor's way back: this view, as it stands.
        const base = new URLSearchParams({ urn, kind: viewed.kind, returnTo: returnToHere(urn, `/sets/${id === "default" ? `default?${sp.toString()}` : `${id}?urn=${urn}`}`) });
        if (viewed.phase) base.set("phase", viewed.phase);
        else base.set("entry", viewed.entry);
        const edit = new URLSearchParams(base);
        if (viewed.id) edit.set("set", viewed.id);
        else {
          edit.set("from", viewed.key);
          edit.set("name", viewed.name);
          edit.set("urns", viewed.members.map((x) => x.urn).join(","));
        }
        const dup = new URLSearchParams(base);
        dup.set("from", viewed.key);
        dup.set("name", `${viewed.name} (copy)`);
        dup.set("urns", viewed.members.map((x) => x.urn).join(","));
        const wayBackLink = <SetsWayBack back={back} phone={phone} set={{ id: viewed.id, kind: viewed.kind, entry: viewed.phase ? null : viewed.entry, phase: viewed.phase }} />;
        return (
          <>
            {phone ? (
              <div className="px-4 pt-2">{wayBackLink}</div>
            ) : (
              <div className="mb-3 flex flex-col gap-1">
                {wayBackLink}
                <nav className="text-[12px] text-[var(--muted2)]" aria-label="Breadcrumb">
                  <a href={`/sets?urn=${urn}${keepBack}`} className="hover:underline">Sets</a> › {viewed.name}
                </nav>
              </div>
            )}
            <SetView urn={urn} schoolName={m.member.schoolName} set={viewed} editHref={`/sets/edit?${edit}`} duplicateHref={`/sets/edit?${dup}`} phone={phone} />
          </>
        );
      }}
    </SetsShell>
  );
}

export default function SetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={null}>
      <View id={id} />
    </Suspense>
  );
}
