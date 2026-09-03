import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Bricolage Grotesque for brand/marketing moments (wordmark, headlines) —
// chosen over the far more common Space Grotesk specifically because that
// one reads as templated at this point.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "frontdesk.ai — an AI front desk that never clocks out",
    template: "%s · frontdesk.ai",
  },
  description:
    "An AI front desk that answers customer questions from your own documents and captures leads while you sleep.",
};

// The app is dark end to end, so tell the browser — otherwise form controls,
// scrollbars and the mobile URL bar render in light chrome against navy.
export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0c1a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}
    >
      <body className="flex min-h-screen flex-col bg-void font-body text-cream">{children}</body>
    </html>
  );
}
