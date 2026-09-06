import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import "./globals.css";
// Map redesign (2026-08-23, State of the School page): Leaflet + CartoDB Positron,
// a deliberate, agreed exception to this project's usual "no charting/map library"
// pattern -- see SchoolMap.tsx's own module comment. Leaflet's stylesheet must be a
// real global import, not scoped to the component -- Next's App Router only reliably
// applies global (non-module) CSS imported from the root layout.
import "leaflet/dist/leaflet.css";
// 2026-09-07, UX refinements round 2, P2 item 6: "too easy to accidentally zoom/
// pan while scrolling the page" -- leaflet-gesture-handling (MIT, zero deps, the
// exact "Prompt desktop users to use Ctrl+Mouse Wheel to zoom... Google Maps
// gesture handling" plugin Guy's own request named) adds the hint overlay this
// stylesheet renders. Global import for the same reason leaflet.css itself is --
// harmless on any map that doesn't opt into the `gestureHandling: true` map
// option (MapView.tsx does; SchoolMap.tsx, the public map, deliberately doesn't --
// this round's request was scoped to the Data View, not a site-wide behaviour
// change to a page members already know how to use).
import "leaflet-gesture-handling/dist/leaflet-gesture-handling.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const allowIndexing = process.env.ALLOW_INDEXING === "true";

export const metadata: Metadata = {
  title: "VicData",
  description: "VicData — school data, decision-ready.",
  robots: allowIndexing
    ? { index: true, follow: true }
    : { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NavBar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
