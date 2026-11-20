import { useId, useRef, useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { Logo } from "@/components/auth/Logo";
import { RoleChip } from "@/components/dashboard/RoleChip";
import { cn } from "@/utils/cn";
import { AuthSection } from "./AuthSection";

// Your App.tsx has no "/tournaments" index route yet — tournament pages are
// all detail/action routes (/tournaments/:id, /tournaments/create, ...)
// reached from the dashboard. Add a second entry here once a tournaments
// list page + route exists, e.g. { label: "Tournaments", to: "/tournaments" }.
const NAV_ITEMS = [{ label: "Dashboard", to: "/dashboard" }];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const mobileId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);

  return (
    <header
      className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur-xl"
      onKeyDown={(event) => {
        if (event.key === "Escape" && mobileOpen) {
          setMobileOpen(false);
          toggleRef.current?.focus();
        }
      }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" aria-label="Go to Dashboard">
            <Logo />
          </Link>

          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Primary"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "relative rounded-full px-3.5 py-2 text-sm font-semibold transition-colors duration-200",
                    isActive
                      ? "text-emerald-700"
                      : "text-slate-500 hover:text-slate-900",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {item.label}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-emerald-500 transition-opacity duration-200",
                        isActive ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <RoleChip />
          </div>

          <AuthSection />

          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls={mobileId}
            ref={toggleRef}
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 md:hidden"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Closed links are unmounted, not invisible keyboard-focus targets. */}
      {mobileOpen && (
        <div id={mobileId} className="border-t border-slate-100 md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-3" aria-label="Mobile">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
                    isActive
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-600 hover:bg-slate-50",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="mt-2 border-t border-slate-100 pt-3">
              <RoleChip />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
