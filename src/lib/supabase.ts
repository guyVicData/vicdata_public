import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser/client-safe: anon key only, RLS enforced (e.g. schools_select_anyone,
// search_schools granted to anon). Never import the service-role client below into
// client components.
//
// Singleton, not a fresh client per caller: multiple GoTrueClient instances sharing the
// same localStorage auth-token key triggers Supabase's own "undefined behavior" warning
// (confirmed in dev console -- SchoolSearch and its ManualSchoolRequestForm child were
// each creating their own client).
let browserClient: SupabaseClient | null = null;

export function createBrowserSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}

// Server-only: bypasses RLS. Never imported from a "use client" file.
export function createServiceRoleSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
