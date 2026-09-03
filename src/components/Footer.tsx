import Link from "next/link";

// Minimal site footer (round 16) -- same neutral palette/border convention as
// NavBar.tsx, the only other piece of site-wide chrome. Exists mainly to give
// RollCard's own data-source caption (dashboard/RollCard.tsx) a real link target,
// not a citation with nowhere to go.
export default function Footer() {
  return (
    <footer className="mt-auto border-t border-neutral-100 px-6 py-6 text-xs text-neutral-500 dark:border-neutral-800">
      <Link href="/sources" className="hover:text-neutral-900 dark:hover:text-neutral-100">
        Sources & methodology
      </Link>
    </footer>
  );
}
