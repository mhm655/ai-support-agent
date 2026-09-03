"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { BrandLink } from "@/components/Brand";
import { ChatIcon, LogOutIcon, UserIcon } from "@/lib/icons";

const NAV = [
  { href: "/dashboard", label: "Agents", icon: ChatIcon },
  { href: "/dashboard/profile", label: "Profile", icon: UserIcon },
];

/*
 * The chrome every signed-in screen sits inside: sticky translucent top bar,
 * primary nav with an active state, and a single content column. Pages used
 * to each render their own header, which is how the dashboard, the profile
 * page and the agent detail view ended up with three different headers.
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
    <div className="relative flex min-h-screen flex-col">
      {/* Accent wash behind the top of every page, so the header doesn't sit
          on a dead flat field. Purely decorative and non-interactive. */}
      <div aria-hidden="true" className="glow-amber pointer-events-none absolute inset-x-0 top-0 h-72" />

      <header className="sticky top-0 z-30 border-b border-line bg-void/80 backdrop-blur-xl">
        <div className={`mx-auto flex w-full ${width} items-center gap-4 px-5 py-3 sm:px-8`}>
          <BrandLink href="/dashboard" />

          {/* Labels drop away on narrow screens, but the links themselves
              stay — hiding the whole nav left no way to reach Profile on a
              phone. */}
          <nav aria-label="Dashboard" className="ml-1 flex items-center gap-1 sm:ml-2">
            {NAV.map(({ href, label, icon: Icon }) => {
              // /dashboard is a prefix of every other route, so it only counts
              // as active on an exact match.
              const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`focus-ring flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition ${
                    active
                      ? "bg-cream/10 font-medium text-cream"
                      : "text-mist hover:bg-cream/5 hover:text-cream"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sr-only sm:hidden">{label}</span>
                </Link>
              );
            })}
          </nav>

          <button onClick={handleLogout} className="btn btn-ghost ml-auto px-3 py-1.5 text-xs sm:text-sm">
            <LogOutIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Log out</span>
            <span className="sr-only sm:hidden">Log out</span>
          </button>
        </div>
      </header>

      <main className={`relative mx-auto w-full ${width} flex-1 px-5 py-10 sm:px-8`}>{children}</main>

      <footer className="relative border-t border-line px-5 py-6 sm:px-8">
        <p className="mx-auto max-w-5xl font-mono text-[11px] text-dusk">
          frontdesk.ai — a portfolio project
        </p>
      </footer>
    </div>
  );
}
