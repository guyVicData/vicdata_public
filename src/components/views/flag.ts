"use client";

// VicData 0.6.1 S3: the switch for the config-driven view renderer. Off by default: with it
// off, members' pages draw exactly as today (the hosts draw every view, rail.tsx filters
// their rails). On: `?views=v2` on the URL, or NEXT_PUBLIC_VIEWS=v2 at build time; a
// surface that always renders v2 (S4's editor previews) provides it through
// ViewsModeContext.
import { createContext, useContext, useState } from "react";

export type ViewsMode = "v1" | "v2";

export function viewsV2Requested(search: URLSearchParams | null): boolean {
  if (process.env.NEXT_PUBLIC_VIEWS === "v2") return true;
  return search?.get("views") === "v2";
}

// null = not set by the surface: the URL / env decides.
export const ViewsModeContext = createContext<ViewsMode | null>(null);

export function useViewsV2(): boolean {
  const set = useContext(ViewsModeContext);
  // Read once: the switch is the page's, for its whole life. Configured panels only draw
  // after the page's data has loaded on the client, so there is no server render to match.
  const [fromUrl] = useState(() => viewsV2Requested(typeof window === "undefined" ? null : new URLSearchParams(window.location.search)));
  return set ? set === "v2" : fromUrl;
}
