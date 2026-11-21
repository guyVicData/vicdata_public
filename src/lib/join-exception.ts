// 0.8 front door part 3 (E25, R-JOIN-DOMAIN): approving a join request. Client-safe. A request from outside the
// school's email domains (school_memberships.off_domain) is an exception: it is approved only explicitly, with the
// exception's own two fields in the same update -- the database refuses anything else
// (school_memberships_exception_guard, 20261126090000).

/** The update that approves a waiting request by the School-Admin `byMembershipId`. */
export function approvalUpdate(o: { offDomain: boolean; byMembershipId: string | null; now?: Date; extra?: Record<string, unknown> }): Record<string, unknown> {
  const at = (o.now ?? new Date()).toISOString();
  return {
    status: "approved",
    approved_at: at,
    approved_by: o.byMembershipId,
    ...(o.extra ?? {}),
    ...(o.offDomain ? { exception_approved_at: at, exception_approved_by: o.byMembershipId } : {}),
  };
}

/** The words for a waiting request: on the school's domain, or an exception. */
export function joinRequestWords(o: { offDomain: boolean; email: string | null }): { tag: string | null; line: string; approve: string } {
  if (o.offDomain) return { tag: "Exception", line: `${o.email ?? "No email"} · outside your school's email domains`, approve: "Approve as an exception" };
  return { tag: null, line: "school email matched", approve: "Approve as Teacher" };
}

/** Reads school_memberships with off_domain when the column exists (after the migration), else without it. */
export async function selectWithOffDomain<T>(read: (cols: string) => PromiseLike<{ data: unknown; error: { message: string } | null }>, cols: string): Promise<{ data: T[] | null; error: { message: string } | null }> {
  let r = await read(`${cols}, off_domain`);
  if (r.error && /off_domain/.test(r.error.message)) r = await read(cols);
  return { data: (r.data as T[] | null) ?? null, error: r.error };
}
