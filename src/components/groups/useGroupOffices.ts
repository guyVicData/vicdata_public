"use client";

// VicData 0.8 groups r1: the signed-in person's head-office accounts (/api/group/me, which first takes up
// any invitation to their confirmed address), and the one in view: ?account=, else the first. A platform
// admin in head-office View as gets the account they are viewing, read-only.
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import type { HeadOffice } from "@/lib/groups/access-rules";

export type OfficesState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "none" }
  | { status: "ready"; office: HeadOffice; all: HeadOffice[]; viewAs: boolean; token: string };

export async function groupToken(): Promise<string | null> {
  const { data } = await createBrowserSupabaseClient().auth.getSession();
  return data.session?.access_token ?? null;
}

export function useGroupOffices(): OfficesState {
  const [state, setState] = useState<OfficesState>({ status: "loading" });
  useEffect(() => {
    let live = true;
    (async () => {
      const token = await groupToken();
      if (!token) return live && setState({ status: "signed-out" });
      const res = await fetch("/api/group/me", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      if (!live) return;
      if (!res || !res.ok) return setState({ status: res?.status === 401 ? "signed-out" : "none" });
      const b = (await res.json()) as { offices: HeadOffice[]; viewAs: boolean };
      if (!b.offices.length) return setState({ status: "none" });
      const wanted = new URLSearchParams(window.location.search).get("account");
      setState({ status: "ready", office: b.offices.find((o) => o.id === wanted) ?? b.offices[0], all: b.offices, viewAs: b.viewAs, token });
    })();
    return () => {
      live = false;
    };
  }, []);
  return state;
}
