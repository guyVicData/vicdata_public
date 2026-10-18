// Run: npx -y tsx --test --test-force-exit src/lib/notes-feedback.test.ts
// The panels' children are render functions, passed as the `children` prop so `next build`'s type check
// accepts them (as a createElement argument it doesn't): react/no-children-prop is off for this file.
/* eslint-disable react/no-children-prop */
// VicData 0.8 notes and feedback: the round's rules that run without a browser or a database --
//   R-FOOTER-LAYOUT       a panel's footer is (i), note, feedback bottom left and the menu bottom right;
//                         the header's icon row keeps full screen (and the collapse slot) only; there is
//                         no caption button anywhere (the server render of every footer).
//   R-CAPTION-IN-INFO     the caption is the (i)'s "What this shows" line, and full screen prints it.
//   R-NOTE-PER-VIEW       two views in one rail have two note keys; the icon colours only with a note;
//                         the old-notes migration's pattern never matches a view's key or View as' sets.
//   R-FEEDBACK-COLOURS    yellow with open feedback, green after a bare "Looks good", yellow when both,
//                         monochrome once everything on the view is done.
//   R-FEEDBACK-AUDIENCE   the route refuses a member the setting doesn't let in (403, nothing stored),
//                         and tells the page there is no icon to draw.
//   R-FEEDBACK-CONTEXT    (the parts that aren't the browser's) the item the page sends carries every
//                         recorded field, and its Open link restores the address.
// The browser's halves (the window, the colours on screen, the Open link) are
// docs/v0.8/audit_scripts/notes_feedback/notes_feedback.mjs; the database's are
// supabase/tests/v08_notes_feedback_pglite.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

import { feedbackColour, feedbackNumber, feedbackOpenHref, isOpenFeedback, parseFeedbackNumber, recordedQuery, viewKey, viewNoteKey, type FeedbackMark, type ViewSurface } from "./view-ref";
import { feedbackRow, triagePatch } from "./feedback-server";
import { feedbackPayload, canSend, type FormState } from "@/components/feedback/FeedbackWindow";
import { RailPanel } from "@/components/shell/RailPanel";
import { CardBox, OpenInFullscreen } from "@/components/shell/CardBox";
import { ViewSurfaceContext } from "@/components/feedback/ViewSurface";
import { resetFeedbackStore } from "@/components/feedback/store";
import { PanelExport } from "@/components/shell/PanelFooter";
import { PANEL_ICON_ORDER } from "@/components/shell/PanelIconRow";

const SURFACE: ViewSurface = {
  product: "smt",
  dashboard: { id: "vicdata.smt.academic", name: "Academic", versionId: "ver-7" },
  scope: { kind: "school", urn: "110110", name: "Leighton Park School" },
  role: "smt",
  viewAs: true,
  peek: false,
  noteScope: "110110",
  state: { level: "gcse", area: "sciences", set: "10 nearest", setKind: "nearest" },
};

// ----------------------------------------------------------------------------------- footer

function withSurface(node: ReturnType<typeof createElement>, notes: Record<string, string> = {}) {
  const value = { surface: SURFACE, config: null, notes: { enabled: true, get: (k: string) => notes[k] ?? null, save: async () => undefined } };
  return createElement(ViewSurfaceContext.Provider, { value }, node);
}
const panel = (o: { instanceId?: string; caption?: string } = {}) =>
  createElement(
    RailPanel,
    {
      id: "p-large",
      tag: "Subjects",
      title: "Subjects",
      height: 400,
      rail: [
        { id: "v-subjects", label: "Subjects", icon: "TilesIcon" },
        { id: "v-areas", label: "Subject areas", icon: "TilesIcon" },
      ],
      railActive: o.instanceId ?? "v-subjects",
      onRail: () => undefined,
      source: "Source: DfE performance tables.",
      caption: o.caption ?? "Ranks among all schools with entries.",
      flag: "▲ Growing",
      view: { panelId: "p-large", panelName: "Large view", instanceId: o.instanceId ?? "v-subjects", dataview: "DV-SMT-A-SUBJECTS" },
      children: () => createElement("div", null, "figure"),
    },
  );

test("R-FOOTER-LAYOUT: (i), note, feedback bottom left; flag then menu bottom right; header keeps full screen only", () => {
  resetFeedbackStore({ status: "ready", allowed: true, items: [] });
  const html = renderToStaticMarkup(withSurface(panel()));
  const footer = html.slice(html.indexOf("data-panel-footer"));
  const at = (needle: string) => footer.indexOf(needle);
  assert.ok(at('aria-label="Where this figure comes from"') > 0, "the (i)");
  assert.ok(at("data-note-button") > at('aria-label="Where this figure comes from"'), "the note after the (i)");
  assert.ok(at("data-feedback-button") > at("data-note-button"), "feedback after the note");
  const right = footer.slice(at("data-panel-footer-right"));
  assert.ok(right.indexOf("▲ Growing") >= 0 && right.indexOf("data-panel-menu") > right.indexOf("▲ Growing"), "the flag, then the menu, at the right");
  const header = html.slice(0, html.indexOf("data-panel-footer"));
  assert.deepEqual([...PANEL_ICON_ORDER], ["fullscreen", "collapse"]);
  assert.ok(!header.includes("data-panel-menu") && !header.includes('data-panel-icon="menu"'), "no menu in the header's icon row");
  assert.ok(header.includes('data-panel-icon="fullscreen"') && header.includes('data-panel-icon="collapse"'));
});

test("R-FOOTER-LAYOUT: no caption button anywhere (card, full screen, a panel with no view)", () => {
  resetFeedbackStore({ status: "ready", allowed: true, items: [] });
  const card = renderToStaticMarkup(withSurface(panel()));
  const full = renderToStaticMarkup(createElement(OpenInFullscreen.Provider, { value: true }, withSurface(panel())));
  const bare = renderToStaticMarkup(createElement(CardBox, { title: "Plain", caption: "A caption", source: "A source", menu: ({ print }: { print: () => void }) => createElement(PanelExport, { onPrint: print }), children: () => "x" }));
  for (const html of [card, full, bare]) assert.ok(!/aria-label="What this shows"/.test(html), "the caption button is gone");
  // The modal's footer: feedback and the menu, the (i) in focus mode.
  const modalFooter = full.slice(full.indexOf('data-panel-footer="modal"'));
  assert.ok(modalFooter.includes("data-feedback-button") && modalFooter.includes("data-panel-menu"));
});

test("R-CAPTION-IN-INFO: the caption is the (i)'s 'What this shows' line, and full screen prints it", () => {
  resetFeedbackStore({ status: "ready", allowed: true, items: [] });
  const full = renderToStaticMarkup(createElement(OpenInFullscreen.Provider, { value: true }, createElement(CardBox, { title: "Trend", caption: "Mathematics has grown the most.", source: "Source: DfE.", children: () => "x" })));
  assert.match(full, /data-what-this-shows=""[^>]*>.*What this shows: .*Mathematics has grown the most\./, "printed as the (i)'s line in full screen");
  // On the card the (i) holds it (its popover renders on click, in a portal); the button is there with
  // or without a source.
  const onlyCaption = renderToStaticMarkup(createElement(CardBox, { title: "T", caption: "Only a caption", children: () => "x" }));
  assert.ok(onlyCaption.includes('aria-label="Where this figure comes from"'), "a caption alone still gives the (i)");
});

test("R-NOTE-PER-VIEW: one note per view, coloured only where there is one", () => {
  const a = viewNoteKey("vicdata.smt.academic", "p-large", "v-subjects");
  const b = viewNoteKey("vicdata.smt.academic", "p-large", "v-areas");
  assert.notEqual(a, b, "two views in one rail, two keys");
  resetFeedbackStore({ status: "ready", allowed: true, items: [] });
  const withNote = renderToStaticMarkup(withSurface(panel({ instanceId: "v-subjects" }), { [a]: "Check Physics" }));
  const without = renderToStaticMarkup(withSurface(panel({ instanceId: "v-areas" }), { [a]: "Check Physics" }));
  assert.match(withNote, /data-note-button="on"/);
  assert.match(without, /data-note-button="off"/);
  assert.match(withNote, /text-\[var\(--note-on\)\]/, "the shared note token");
  // The migration that removes the old notes (20261117090000) never matches a view's note or View as' sets.
  const oldNote = (schoolUrn: string, chartKey: string) => !/~sets$/.test(schoolUrn) && !/^(view|meeting|set|ranking):/.test(chartKey);
  assert.equal(oldNote("110110", a), false);
  assert.equal(oldNote("110110~trial~smt", a), false, "a View as note is a view note too");
  assert.equal(oldNote("110110~trial~smt~sets", "set:abc"), false);
  assert.equal(oldNote("137625", "meeting:m1:v1"), false);
  assert.equal(oldNote("100053", "ks4:results:Biology"), true);
});

// ----------------------------------------------------------------------------------- colours

const mark = (o: Partial<FeedbackMark>): FeedbackMark => ({ status: "new", looksGood: false, hasText: true, kinds: [], schoolKey: "school:110110", ...o });

test("R-FEEDBACK-COLOURS: yellow, green, yellow wins, monochrome once done", () => {
  const here = "school:110110";
  assert.equal(feedbackColour([], here), "none");
  assert.equal(feedbackColour([mark({})], here), "open", "open feedback: yellow");
  assert.equal(feedbackColour([mark({ hasText: false, looksGood: true, kinds: ["looks_good"] })], here), "good", "a bare Looks good: green");
  assert.equal(feedbackColour([mark({ hasText: false, looksGood: true, kinds: ["looks_good"] }), mark({})], here), "open", "both: yellow wins");
  assert.equal(feedbackColour([mark({ status: "done" }), mark({ status: "wont_do" })], here), "none", "everything done: monochrome");
  assert.equal(feedbackColour([mark({ hasText: false, looksGood: true, kinds: ["looks_good"], status: "done" })], here), "none", "a Looks good marked done: monochrome too");
  assert.equal(feedbackColour([mark({ schoolKey: "school:137625" })], here), "open", "open feedback on any school");
  assert.equal(feedbackColour([mark({ hasText: false, looksGood: true, kinds: ["looks_good"], schoolKey: "school:137625" })], here), "none", "Looks good is per school");
  assert.equal(isOpenFeedback(mark({ hasText: true, looksGood: true, kinds: ["looks_good"] })), true, "Looks good with words is open");
  assert.equal(isOpenFeedback(mark({ hasText: false, looksGood: true, kinds: ["looks_good", "wording"] })), true);
});

// ----------------------------------------------------------------------------------- the item

const FORM: FormState = { kinds: ["wrong_figure"], importance: "before_demo", scope: "this_school", applies: "this_view", where: ["figure"], area: [], saw: "62%", expected: "about 58%", text: "Chemistry's share looks high" };

test("R-FEEDBACK-CONTEXT: the item carries every recorded field, and Open restores the address", () => {
  const p = feedbackPayload(SURFACE, { view: { panelId: "p-large", panelName: "Large view", instanceId: "v-subjects", dataview: "DV-SMT-A-SUBJECTS", label: "Subjects" }, viewKey: viewKey("vicdata.smt.academic", "p-large", "v-subjects") }, FORM, { path: "/teacher/smt/academic", search: "?level=gcse&area=sciences&fb=F-1&lookAs=1&as=smt&peek=1", width: 1440, theme: "dark" });
  assert.equal(p.view_as, true);
  assert.equal(p.role, "smt");
  assert.equal(p.school_urn, "110110");
  assert.equal(p.dashboard_id, "vicdata.smt.academic");
  assert.equal(p.dashboard_version_id, "ver-7");
  assert.equal(p.panel_id, "p-large");
  assert.equal(p.view_instance_id, "v-subjects");
  assert.equal(p.dataview_id, "DV-SMT-A-SUBJECTS");
  assert.equal(p.view_label, "Subjects");
  assert.deepEqual(p.state, SURFACE.state);
  assert.equal(p.page_query, "level=gcse&area=sciences", "the page's own address, without the reopen and peek parameters");
  assert.equal(p.device, "desktop");
  assert.equal(p.theme, "dark");
  assert.equal(p.saw, "62%");
  const built = feedbackRow(p, "abc123def456");
  assert.ok("row" in built);
  assert.equal(built.row.app_version, "abc123def456");
  assert.equal(built.row.looks_good, false);
  assert.ok(!("status" in built.row) && !("type" in built.row) && !("author_id" in built.row), "status, triage and author are the database's");
  const href = feedbackOpenHref({ number: 12, page_path: "/teacher/smt/academic", page_query: "level=gcse&area=sciences", school_urn: "110110", group_ref: null, role: "smt", panel_id: "p-large", view_instance_id: "v-subjects" });
  const u = new URL(href!, "https://x.test");
  assert.equal(u.pathname, "/teacher/smt/academic");
  assert.deepEqual(Object.fromEntries(u.searchParams), { level: "gcse", area: "sciences", lookAs: "110110", as: "smt", peek: "1", fb: "F-12", fbPanel: "p-large", fbView: "v-subjects" });
  assert.equal(recordedQuery("?a=1&fbPanel=x&peek=1"), "a=1");
  assert.equal(feedbackNumber(12), "F-12");
  assert.equal(parseFeedbackNumber("f12"), 12);
});

test("an item needs text or Looks good; a bare Looks good is valid", () => {
  assert.equal(canSend({ ...FORM, text: "", kinds: [] }), false);
  assert.equal(canSend({ ...FORM, text: "", kinds: ["looks_good"] }), true);
  const bare = feedbackRow({ product: "smt", dashboard_id: "d", view_key: "d:p:v", school_urn: "110110", body: "", kinds: ["looks_good"] }, "dev");
  assert.ok("row" in bare && bare.row.looks_good === true);
  assert.deepEqual(feedbackRow({ product: "smt", dashboard_id: "d", view_key: "d:p:v", school_urn: "110110", body: " ", kinds: [] }, "dev"), { error: "Write something, or choose Looks good." });
  assert.ok("error" in feedbackRow({ product: "elsewhere", dashboard_id: "d", view_key: "k", school_urn: "1", body: "x" }, "dev"));
  const noFigure = feedbackRow({ product: "smt", dashboard_id: "d", view_key: "k", school_urn: "1", body: "x", kinds: ["wording"], saw: "1", expected: "2" }, "dev");
  assert.ok("row" in noFigure && noFigure.row.saw === null, "I see / I expected only with 'wrong figure'");
});

test("triage: only the triage fields; planned needs a version, won't do a reason", () => {
  assert.deepEqual(triagePatch({ status: "planned", planned_version: "0.85", body: "rewritten" }), { patch: { status: "planned", planned_version: "0.85" } });
  assert.ok("error" in triagePatch({ status: "planned", planned_version: "" }));
  assert.ok("error" in triagePatch({ status: "wont_do", wont_do_reason: "" }));
  assert.ok("error" in triagePatch({ status: "closed" }));
});

// ----------------------------------------------------------------------------------- the route

// A stand-in Supabase for /api/feedback: the audience setting and RLS reduced to what the rules need.
let audience: "admins" | "beta" | "all" = "admins";
const ADMINS = new Set(["guy"]);
const stored: Record<string, unknown>[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  const uid = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+tok-/i, "") || null;
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  if (u.pathname === "/auth/v1/user") return uid ? json({ id: uid, aud: "authenticated" }) : json({ msg: "bad jwt" }, 401);
  const allowed = !!uid && (audience === "all" || ADMINS.has(uid));
  if (u.pathname === "/rest/v1/rpc/feedback_allowed") return json(allowed);
  if (u.pathname === "/rest/v1/feedback_items" && req.method === "POST") {
    if (!allowed) return json({ code: "42501", message: 'new row violates row-level security policy for table "feedback_items"' }, 403);
    const row = { ...((await req.json()) as Record<string, unknown>), id: `id-${stored.length + 1}`, number: stored.length + 1, created_at: new Date().toISOString(), status: "new" };
    stored.push(row);
    return json(row, 201);
  }
  if (u.pathname === "/rest/v1/feedback_items" && req.method === "GET") return json(stored.filter((r) => r.author_id === uid));
  return json({ message: `unexpected ${req.method} ${u.pathname}` }, 500);
}) as typeof fetch;

const route = async () => import("@/app/api/feedback/route");
const call = async (method: "GET" | "POST", who: string, body?: unknown) => {
  const r = await route();
  const req = new NextRequest("http://app.test/api/feedback", { method, headers: { authorization: `Bearer tok-${who}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return method === "GET" ? r.GET(req) : r.POST(req);
};
const ITEM = { product: "smt", dashboard_id: "vicdata.smt.academic", view_key: "vicdata.smt.academic:p-large:v-subjects", school_urn: "110110", body: "", kinds: ["looks_good"] };

test("R-FEEDBACK-AUDIENCE: at 'admins' a member gets no icon and the server refuses their item", async () => {
  audience = "admins";
  const g = (await (await call("GET", "member")).json()) as { allowed: boolean };
  assert.equal(g.allowed, false, "the page draws no icon");
  const p = await call("POST", "member", ITEM);
  assert.equal(p.status, 403);
  assert.equal(stored.length, 0, "nothing stored");
  const ok = await call("POST", "guy", ITEM);
  assert.equal(ok.status, 200);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].author_id, "guy");
  const mine = (await (await call("GET", "guy")).json()) as { allowed: boolean; items: { has_text: boolean }[] };
  assert.equal(mine.allowed, true);
  assert.equal(mine.items.length, 1);
  audience = "all";
  assert.equal(((await (await call("GET", "member")).json()) as { allowed: boolean }).allowed, true, "at 'all' every signed-in member");
});
