import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { MotionProvider } from "@/components/marketing/Motion";

/*
 * Archivo carries the display voice, loaded as a variable font with its
 * width axis ("wdth", 62-125). The landing hero sets it heavy, condensed and
 * uppercase (.display-poster); other headings use it at normal width.
 * Loading the variable file rather than a list of static weights is what
 * makes the width axis available at all, and covers every weight in one
 * request.
 *
 * Instrument Sans reads cleanly at body sizes without the ubiquity of
 * Inter, and JetBrains Mono handles technical labels and code.
 */
const display = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-display",
});
const body = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: {
    default: "frontdesk.ai, an AI front desk that never clocks out",
    template: "%s · frontdesk.ai",
  },
  description:
    "An AI front desk that answers customer questions from your own documents and captures leads while you sleep.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f4f4f2",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}
    >
      <body className="flex min-h-screen flex-col bg-paper font-body text-ink">
        {/* reducedMotion="user" makes every Motion animation in the tree
            respect the OS setting, so no component has to branch on it. */}
        <MotionProvider>
          <ToastProvider>{children}</ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
