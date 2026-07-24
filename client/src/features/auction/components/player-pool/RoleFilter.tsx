import { cn } from "@/lib/utils";
import { ROLE_OPTIONS, type PlayerRole } from "@/features/auction/hooks/usePlayerPool";
import { X } from "lucide-react";

interface RoleFilterProps {
  activeRoles: PlayerRole[];
  onToggle: (role: PlayerRole) => void;
  onClear: () => void;
}

export function RoleFilter({ activeRoles, onToggle, onClear }: RoleFilterProps) {
  const hasActive = activeRoles.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        Filter by Role
      </span>
      {ROLE_OPTIONS.map((opt) => {
        const isActive = activeRoles.includes(opt.value);
        return (
          <button
            key={opt.value}
            onClick={() => onToggle(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200",
              isActive
                ? opt.color + " ring-1 ring-white/20 scale-105"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-slate-300"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                isActive ? "bg-current" : "bg-slate-600"
              )}
            />
            {opt.label}
          </button>
        );
      })}
      {hasActive && (
        <button
          onClick={onClear}
          className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 transition hover:bg-rose-500/20"
        >
          <X className="h-3 w-3" />
          Clear
        </button>
      )}
    </div>
  );
}