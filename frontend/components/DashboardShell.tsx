"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { BrandLink } from "@/components/Brand";

const NAV = [
  { href: "/dashboard", label: "Agents" },
  { href: "/dashboard/profile", label: "Profile" },
];

/*
 * The chrome every signed-in screen sits inside: sticky top bar, primary
 * nav with an active state, and a single content column. Pages used to each
 * render their own header, which is how the dashboard, the profile page and
 * the agent detail view ended up with three different headers.
 *
 * Text-only nav: two short words fit on any screen, so an icon beside each
 * (and an icon-only fallback on phones) added nothing but decoration.
 */
export default function DashboardShell({
  children,
  width = "max-w-5xl",
}: {
  children: React.ReactNode;
  width?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-edge bg-paper/85 backdrop-blur-xl">
        <div className={`mx-auto flex h-16 w-full ${width} items-center gap-6 px-5 sm:px-8`}>
          <BrandLink href="/dashboard" />

          <nav aria-label="Dashboard" className="flex items-center gap-5 sm:ml-4">
            {NAV.map(({ href, label }) => {
              const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`focus-ring rounded text-[14px] transition ${
                    active
                      ? "font-medium text-ink underline decoration-volt decoration-2 underline-offset-[6px]"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <button
            onClick={handleLogout}
            className="focus-ring ml-auto rounded text-[14px] text-ink-muted transition hover:text-ink"
          >
            Log out
          </button>
        </div>
      </header>

      <main className={`mx-auto w-full ${width} flex-1 px-5 py-12 sm:px-8`}>{children}</main>

      <footer className="border-t border-edge px-5 py-6 sm:px-8">
        <p className={`mx-auto ${width} text-[13px] text-ink-faint`}>frontdesk.ai, a portfolio project</p>
      </footer>
    </div>
  );
}
