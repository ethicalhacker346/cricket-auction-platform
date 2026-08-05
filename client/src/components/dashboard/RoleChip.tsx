import {
  Building2,
  Gavel,
  ShieldCheck,
  Trophy,
  CheckCircle2,
  Crown,
} from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { ROLE_LABELS } from "@/lib/constants/roles";
import type { UserRole } from "@/types/user";
import { cn } from "@/utils/cn";

const ROLE_META: Record<
  UserRole,
  {
    icon: typeof ShieldCheck;
    className: string;
    dotClass: string;
    badgeClass: string;
    ariaLabel: string;
    ringClass: string;
    glowClass: string;
  }
> = {
  ADMIN: {
    icon: ShieldCheck,
    ariaLabel: "Authenticated as Administrator",
    className:
      "border-emerald-200/60 bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg shadow-emerald-500/10",
    dotClass: "bg-emerald-400 shadow-emerald-400/50",
    badgeClass:
      "border border-white/10 bg-white/10 text-emerald-200 backdrop-blur-sm",
    ringClass: "ring-emerald-500/20",
    glowClass: "shadow-emerald-500/20",
  },

  ORGANIZER: {
    icon: Gavel,
    ariaLabel: "Authenticated as Organizer",
    className:
      "border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 shadow-lg shadow-amber-500/10",
    dotClass: "bg-amber-500 shadow-amber-500/50",
    badgeClass:
      "border border-amber-200/60 bg-white/70 text-amber-700 backdrop-blur-sm",
    ringClass: "ring-amber-500/20",
    glowClass: "shadow-amber-500/20",
  },

  PLAYER: {
    icon: Trophy,
    ariaLabel: "Authenticated as Player",
    className:
      "border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-green-50 text-emerald-900 shadow-lg shadow-emerald-500/10",
    dotClass: "bg-emerald-500 shadow-emerald-500/50",
    badgeClass:
      "border border-emerald-200/60 bg-white/70 text-emerald-700 backdrop-blur-sm",
    ringClass: "ring-emerald-500/20",
    glowClass: "shadow-emerald-500/20",
  },

  FRANCHISE_OWNER: {
    icon: Building2,
    ariaLabel: "Authenticated as Franchise Owner",
    className:
      "border-indigo-200/60 bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-900 shadow-lg shadow-indigo-500/10",
    dotClass: "bg-indigo-500 shadow-indigo-500/50",
    badgeClass:
      "border border-indigo-200/60 bg-white/70 text-indigo-700 backdrop-blur-sm",
    ringClass: "ring-indigo-500/20",
    glowClass: "shadow-indigo-500/20",
  },
};

export function RoleChip() {
  const user = useAuthStore((state) => state.user);

  if (!user) return null;

  const meta = ROLE_META[user.role];
  const Icon = meta.icon;

  return (
    <div
      aria-label={meta.ariaLabel}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-full border px-3.5 py-2 transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-xl",
        meta.className,
        meta.glowClass
      )}
    >
      {/* Subtle ring on hover */}
      <div className={cn(
        "absolute inset-0 rounded-full ring-1 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
        meta.ringClass
      )} />

      <span
        aria-hidden
        className={cn(
          "relative h-2.5 w-2.5 rounded-full animate-pulse shadow-lg",
          meta.dotClass
        )}
      />

      <Icon className="relative h-4 w-4 shrink-0" />

      <span className="relative whitespace-nowrap text-xs font-bold uppercase tracking-[0.18em]">
        {ROLE_LABELS[user.role]}
      </span>

      <span
        className={cn(
          "relative hidden items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider lg:flex",
          meta.badgeClass
        )}
      >
        <CheckCircle2 className="h-3 w-3" />
        Verified
      </span>
    </div>
  );
}