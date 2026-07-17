import { NavLink, Outlet } from "react-router-dom";
import {
  BarChart3,
  Gavel,
  History,
  LayoutDashboard,
  ListOrdered,
  Settings2,
  Trophy,
  Users,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { NAV_ITEMS } from "@/features/auction/constants/index.constants";
import { AuctionHeader } from "@/features/auction/components/AuctionHeader";
import { cn } from "@/utils/cn";

const ICONS: Record<string, React.ElementType> = {
  LayoutDashboard,
  Settings2,
  ListOrdered,
  Gavel,
  Users,
  History,
  BarChart3,
  Trophy,
};

export function AuctionShell() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-white/10 bg-slate-950/95 backdrop-blur transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-rose-500">
              <Gavel className="h-4 w-4 text-slate-950" />
            </div>
            <span className="text-sm font-bold tracking-tight text-white">AuctionRoom</span>
          </div>
          <button className="text-slate-400 lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="mt-2 space-y-1 px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = ICONS[item.icon];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                    isActive
                      ? "bg-gradient-to-r from-amber-400/15 to-transparent text-amber-300 ring-1 ring-amber-400/20"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-0 right-0 px-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-slate-500">
            State-driven live auction engine. No polling, no refetching — every screen reacts to the same real-time snapshot.
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-0">
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2 lg:hidden">
          <button className="text-slate-300" onClick={() => setOpen(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-white">Menu</span>
        </div>
        <AuctionHeader />
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}