"use client";

// VicData 0.6.1 S3: the switch for the config-driven view renderer. Since S6 it is ON by
// default: the renderer draws every view from its ViewSpec. The escape hatch is `?views=v1`
// on the URL, or NEXT_PUBLIC_VIEWS=v1 at build time, which puts the hosts back on drawing
// every view (rail.tsx filtering their rails), exactly as before S3. `?views=v2` still
// works (it is the default). A surface that always renders v2 (S4's editor previews)
// provides it through ViewsModeContext.
import { createContext, useContext, useState } from "react";

export type ViewsMode = "v1" | "v2";

export function viewsV2Requested(search: URLSearchParams | null): boolean {
  const fromUrl = search?.get("views");
  if (fromUrl === "v1") return false;
  if (fromUrl === "v2") return true;
  return process.env.NEXT_PUBLIC_VIEWS !== "v1";
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
