import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Bricolage Grotesque for brand/marketing moments (wordmark, landing page
// headlines) — chosen over the far more common Space Grotesk specifically
// because it reads as templated at this point. Reserved for places that
// want personality; the dashboard's own headings use the body font
// instead (see app/dashboard/*), so the working product doesn't borrow
// the marketing page's voice.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "frontdesk.ai",
  description: "An AI front desk that answers customer questions from your own documents and captures leads while you sleep.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body bg-cream text-ink">{children}</body>
    </html>
  );
}
