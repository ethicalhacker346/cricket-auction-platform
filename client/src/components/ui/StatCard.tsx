import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/utils/cn";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
  delay?: number;
  onClick?: () => void;
  active?: boolean;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "bg-emerald-50 text-emerald-600 border-emerald-100",
  delay = 0,
  onClick,
  active = false,
  trend,
  trendValue,
}: StatCardProps) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-600 bg-emerald-50"
      : trend === "down"
      ? "text-rose-600 bg-rose-50"
      : "text-slate-400 bg-slate-50";

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, type: "spring", stiffness: 120, damping: 16 }}
      whileHover={onClick ? { y: -3, scale: 1.02 } : {}}
      whileTap={onClick ? { scale: 0.97 } : {}}
      className={cn(
        "group relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition-all duration-300 sm:gap-4 sm:p-5",
        onClick ? "cursor-pointer" : "cursor-default",
        active
          ? "border-emerald-300/80 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 shadow-md shadow-emerald-900/5 ring-1 ring-emerald-200/60"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md hover:bg-slate-50/60"
      )}
    >
      {/* Subtle active glow */}
      {active && (
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-emerald-400/10 blur-2xl" />
      )}

      <span
        className={cn(
          "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 group-hover:scale-105 group-hover:shadow-sm sm:h-12 sm:w-12",
          accent
        )}
      >
        <Icon className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <p className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-400 sm:text-xs">
            {label}
          </p>
          {trend && (
            <span className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold", trendColor)}>
              <TrendIcon className="h-3 w-3" />
              {trendValue}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
          {value}
        </p>
      </div>

      {active && (
        <motion.span
          layoutId="stat-active-dot"
          className="ml-auto hidden h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30 sm:block"
        />
      )}

      {onClick && !active && (
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-slate-400" />
      )}
    </motion.button>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}