import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  LogOut,
  Settings,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/hooks/useAuth";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import { cn } from "@/utils/cn";
import { DropdownPanel } from "./DropdownPanel";

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const user = useAuthStore((s) => s.user);
  const logout = useLogout();

  useOnClickOutside(containerRef, () => setOpen(false), open);

  if (!user) return null;

  // ── Admin gate guard ─────────────────────────────
  // Defensive: backend may send role as a string or roles as an array.
  const isAdmin =
    user.role === "ADMIN" ||
    user.role === "admin" ||
    (Array.isArray(user.roles) &&
      user.roles.some((r) => r.toUpperCase() === "ADMIN"));
  // ─────────────────────────────────────────────────

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-all duration-200",
          "hover:bg-slate-100",
          open && "bg-slate-100"
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-700 text-xs font-bold text-white shadow-sm shadow-emerald-500/30">
          {getInitials(user.name)}
        </span>
        <span className="hidden max-w-[120px] truncate text-left text-sm font-semibold text-slate-800 sm:block">
          {user.name.split(" ")[0]}
        </span>
        <ChevronDown
          className={cn(
            "hidden h-4 w-4 text-slate-400 transition-transform duration-200 sm:block",
            open && "rotate-180"
          )}
        />
      </button>

      <DropdownPanel open={open} label="Account menu" width="w-64">
        {/* Identity header */}
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="truncate text-sm font-bold text-slate-900">{user.name}</p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>

        {/* ── ADMIN ENTRY GATE ─────────────────────── */}
        {isAdmin && (
          <div role="none" className="border-b border-slate-100 p-2">
            <Link
              role="menuitem"
              to="/admin/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-emerald-50/60"
            >
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              <span>Admin dashboard</span>
            </Link>
          </div>
        )}
        {/* ─────────────────────────────────────────── */}

        {/* Profile / Settings (currently commented out) */}
        {/*<div role="none" className="p-2">
          <Link
            role="menuitem"
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <UserIcon className="h-4 w-4 text-slate-400" />
            View profile
          </Link>
          <Link
            role="menuitem"
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <Settings className="h-4 w-4 text-slate-400" />
            Account settings
          </Link>
        </div>*/}

        {/* Logout */}
        <div role="none" className="border-t border-slate-100 p-2">
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              logout.mutate();
            }}
            disabled={logout.isPending}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {logout.isPending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </DropdownPanel>
    </div>
  );
}