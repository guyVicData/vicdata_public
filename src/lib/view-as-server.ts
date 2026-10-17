// VicData 0.8 View as: the ONE server helper every route resolves its caller through. Server-only (it
// holds the service-role client); the decision itself is view-as.ts's decideCaller, so the rules live
// in one module and are tested there.
//
// It answers, for a request about one school: who is this for? { urn, roles, access, readOnly } --
// member, viewAs (a platform admin's View as of this school), headOffice, or peek (a platform admin
// with no View as here: the Catalogue's ?peek=1 frames, scripts and harnesses). And it gives the route
// two clients:
//   supabase  the caller's own token (anon key + Authorization): every write goes through it, so RLS
//             still decides, and a read-only caller is refused before any write is tried;
//   reader    what the school's own data is read with: the caller's own client for a member (their
//             RLS, exactly as before), and the service role for viewAs, peek and head office, ONLY
//             after the server has confirmed a platform admin (or head office's access). This is
//             what lets View as work at any school -- one where the admin holds no membership, or
//             one with no members or no school account at all -- with no new RLS policy.
//
// Why no `school_accounts` policy for platform admins (the prompt's alternative): every View as read
// is already behind this server check, and a policy would widen what the admin's own browser client
// can read everywhere, for every table that joins through school_accounts. No migration either.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleSupabaseClient } from "./supabase";
import { confirmPlatformAdmin, decideCaller, parsePeekHeader, parseViewAsCookie, parseViewAsGroup, PEEK_HEADER, type CallerAccess, type CallerRoles, type ViewAsRole } from "./view-as";

export type ResolvedCaller = {
  supabase: SupabaseClient;
  reader: SupabaseClient;
  userId: string;
  urn: string;
  roles: string[];
  isAdmin: boolean;
  isAccountHolder: boolean;
  lead: boolean;
  membershipId: string | null;
  access: CallerAccess;
  readOnly: boolean;
  viewAsRole: ViewAsRole | null;
  platformAdmin: boolean;
  // Head office's own details, when access is headOffice (the product's own check fills it).
  headOffice: unknown | null;
};

export type ResolveOptions<H> = {
  // Which members (and which View as roles) the product is for. Default: any approved member.
  allowed?: (r: CallerRoles) => boolean;
  // The product's refusal (403).
  refusal: string;
  // Products head office reads (SMT, its chooser set): may head office read this school? Given the
  // caller's own client and id, and whether this is a platform admin's head-office View as. Returns
  // the product's own detail (truthy) or null.
  headOffice?: (supabase: SupabaseClient, userId: string, viewingAsGroup: boolean) => Promise<H | null>;
  // A route that already made the user client passes it (and the user id, once checked).
  supabase?: SupabaseClient;
  userId?: string;
  // Teacher's and the Data View's routes: a member is anyone the caller's RLS shows an approved row
  // for at this school (RLS shows colleagues only to members) -- the query those routes made before
  // this round, unchanged, so a member's request costs no extra call. No roles, no user id.
  visibleRow?: boolean;
};

const URN = /^[A-Za-z0-9-]{1,20}$/;

/** The caller's own client from the request's token, or the response to send. */
export async function callerClient(request: NextRequest): Promise<{ supabase: SupabaseClient; userId: string } | NextResponse> {
  const auth = request.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Authorization is required" }, { status: 400 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (!data.user?.id) return NextResponse.json({ error: "Sign in again." }, { status: 401 });
  return { supabase, userId: data.user.id };
}

type MemberRow = { id: string; roles: string[] | null; is_admin: boolean | null; admissions_lead?: boolean | null; school_accounts: { account_holder_membership_id: string | null } | null };
const MEMBER_SELECT = "id, roles, is_admin, admissions_lead, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn, account_holder_membership_id)";

/** The caller's own approved membership at `urn` (their RLS), or null. admissions_lead is read only
 * where the 0.7 r1 migration has added it. */
async function visibleRow(supabase: SupabaseClient, urn: string): Promise<{ row: MemberRow | null; error: boolean }> {
  const { data, error } = await supabase
    .from("school_memberships")
    .select("id, school_accounts!school_memberships_school_account_id_fkey!inner(school_urn)")
    .eq("status", "approved")
    .eq("school_accounts.school_urn", urn)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (error) console.error("[view-as-server] membership check failed:", error);
  return { row: !error && data ? { id: data.id, roles: [], is_admin: false, school_accounts: null } : null, error: !!error };
}

async function ownMembership(supabase: SupabaseClient, userId: string, urn: string): Promise<{ row: MemberRow | null; error: boolean }> {
  const read = (select: string) => supabase.from("school_memberships").select(select).eq("profile_id", userId).eq("status", "approved").eq("school_accounts.school_urn", urn).limit(1).maybeSingle<MemberRow>();
  let { data, error } = await read(MEMBER_SELECT);
  if (error && /admissions_lead/.test(error.message)) ({ data, error } = await read(MEMBER_SELECT.replace("admissions_lead, ", "")));
  return { row: error ? null : (data ?? null), error: !!error };
}

/** Who this request is for, at `urn`; or the response to send (400, 401, 403, 502). */
export async function resolveCaller<H = unknown>(request: NextRequest, urn: string | null, opts: ResolveOptions<H>): Promise<(ResolvedCaller & { headOffice: H | null }) | NextResponse> {
  if (!request.headers.get("authorization") || !urn || !URN.test(urn)) return NextResponse.json({ error: "urn and Authorization are required" }, { status: 400 });
  let supabase = opts.supabase;
  let userId = opts.userId;
  if (opts.visibleRow && !supabase) {
    supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: request.headers.get("authorization")! } },
      auth: { persistSession: false },
    });
  }
  if (opts.visibleRow) userId = userId ?? "";
  else if (!supabase || !userId) {
    const c = await callerClient(request);
    if (c instanceof NextResponse) return c;
    ({ supabase, userId } = c);
  }
  const allowed = opts.allowed ?? (() => true);
  const cookie = request.headers.get("cookie");
  // A peek (PEEK_HEADER, the page's own ?lookAs=&as=&peek=1) is decided as a View as of that school and
  // role, or that head office, and then called a peek: read-only and never logged, as View as is.
  const peek = parsePeekHeader(request.headers.get(PEEK_HEADER));
  const peekSchool = peek?.school && peek.school.urn === urn ? { urn, role: peek.school.role, schoolName: urn } : null;
  const viewAs = parseViewAsCookie(cookie) ?? peekSchool;
  const group = opts.headOffice ? (parseViewAsGroup(cookie) ?? (peek?.group ? { accountId: peek.group.accountId, name: "" } : null)) : null;

  const own = opts.visibleRow ? await visibleRow(supabase!, urn) : await ownMembership(supabase!, userId!, urn);
  if (own.error) return NextResponse.json({ error: "Could not verify your membership. Try again." }, { status: 502 });
  const row = own.row;
  const member: CallerRoles | null = row ? { roles: row.roles ?? [], isAdmin: !!row.is_admin, isAccountHolder: row.school_accounts?.account_holder_membership_id === row.id } : null;

  // A member with no View as cookie for here is decided by their membership alone: no extra call.
  const needsAdmin = (viewAs?.urn === urn) || !!group || !member || !allowed(member);
  const platformAdmin = needsAdmin ? await confirmPlatformAdmin(supabase!) : false;

  // Anyone else's head-office cookie is ignored, as a school one is.
  const asGroup = platformAdmin ? group : null;

  // Head office is asked only where the product has it and nothing before it decided.
  let office: H | null = null;
  let headOffice: boolean | null = null;
  const decidedEarlier = (platformAdmin && viewAs?.urn === urn) || (!asGroup && !!member && allowed(member)) || (!asGroup && platformAdmin);
  if (opts.headOffice && !decidedEarlier) {
    office = await opts.headOffice(supabase!, userId!, !!asGroup).catch(() => null);
    headOffice = !!office;
  }

  const d = decideCaller({ urn, viewAs, group: asGroup, platformAdmin, member, allowed, headOffice });
  if (!d) return NextResponse.json({ error: opts.refusal }, { status: 403 });
  const peeked = (d.access === "viewAs" && !!peekSchool && !parseViewAsCookie(cookie)) || (d.access === "headOffice" && !!asGroup && !parseViewAsGroup(cookie));
  if (peeked) d.access = "peek";
  const reader = d.access === "member" ? supabase! : createServiceRoleSupabaseClient();
  return {
    supabase: supabase!,
    reader,
    userId: userId!,
    urn,
    roles: d.roles,
    isAdmin: d.isAdmin,
    isAccountHolder: d.isAccountHolder,
    lead: d.access === "member" && !!row?.admissions_lead,
    membershipId: d.access === "member" ? (row?.id ?? null) : null,
    access: d.access,
    readOnly: d.readOnly,
    viewAsRole: d.viewAsRole,
    platformAdmin,
    headOffice: d.access === "headOffice" ? office : null,
  };
}

/** The school's account id, read with the caller's reader (null: the school has no account). */
export async function schoolAccountIdOf(caller: Pick<ResolvedCaller, "reader">, urn: string): Promise<string | null> {
  const { data } = await caller.reader.from("school_accounts").select("id").eq("school_urn", urn).maybeSingle<{ id: string }>();
  return data?.id ?? null;
}
