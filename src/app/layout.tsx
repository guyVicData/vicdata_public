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
