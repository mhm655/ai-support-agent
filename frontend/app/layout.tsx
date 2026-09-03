import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { MotionProvider } from "@/components/marketing/Motion";

/*
 * Archivo carries the display voice: a grotesque that holds up at 700 and
 * above with tight negative tracking, which is where the page gets its
 * character. Instrument Sans reads cleanly at body sizes without the
 * ubiquity of Inter, and JetBrains Mono handles technical labels and code.
 * Three faces, one job each.
 */
const display = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
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
  themeColor: "#edece7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable} antialiased`}
    >
      <body className="grain flex min-h-screen flex-col bg-paper font-body text-ink">
        {/* reducedMotion="user" makes every Motion animation in the tree
            respect the OS setting, so no component has to branch on it. */}
        <MotionProvider>
          <ToastProvider>{children}</ToastProvider>
        </MotionProvider>
      </body>
    </html>
  );
}
