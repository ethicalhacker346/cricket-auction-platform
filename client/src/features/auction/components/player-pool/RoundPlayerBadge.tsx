import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoundPlayerBadgeProps {
  count: number;
  className?: string;
}

export function RoundPlayerBadge({ count, className }: RoundPlayerBadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-xs font-medium text-slate-400",
        count > 0 && "text-amber-300 border-amber-500/20 bg-amber-500/10",
        className
      )}
    >
      <Users className="h-3 w-3" />
      <span>{count}</span>
      <span className="text-slate-500">{count === 1 ? "player" : "players"}</span>
    </div>
  );
}