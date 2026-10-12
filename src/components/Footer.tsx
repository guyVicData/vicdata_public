import Link from "next/link";
import { FooterEditSwitch, FooterViewAs } from "@/components/edit-mode/EditSwitch";

// Minimal site footer (round 16) -- same neutral palette/border convention as
// NavBar.tsx, the only other piece of site-wide chrome. Exists mainly to give
// RollCard's own data-source caption (dashboard/RollCard.tsx) a real link target,
// not a citation with nowhere to go.
//
// 0.6 snag 2 (B): Guy's "Edit" switch follows, on VicData dashboard pages only
// (FooterEditSwitch renders nothing anywhere else, or for anyone else). 0.7 r3 (F5): and "View
// as…" for platform admins (FooterViewAs), now that the nav pill is gone at rest.
export default function Footer() {
  return (
    <footer className="mt-auto border-t border-neutral-100 px-6 py-6 text-xs text-neutral-500 dark:border-neutral-800">
      <Link href="/sources" className="hover:text-neutral-900 dark:hover:text-neutral-100">
        Sources & methodology
      </Link>
      <FooterEditSwitch />
      <FooterViewAs />
    </footer>
  );
}
