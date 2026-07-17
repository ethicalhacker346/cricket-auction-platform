import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/utils/cn";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
  delay?: number;
  onClick?: () => void;
  active?: boolean;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "bg-emerald-50 text-emerald-600",
  delay = 0,
  onClick,
  active = false,
}: StatCardProps) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left shadow-sm transition-all duration-200",
        onClick ? "cursor-pointer" : "cursor-default",
        active
          ? "border-emerald-300 bg-emerald-50/60 shadow-md ring-1 ring-emerald-200"
          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md hover:bg-slate-50/50"
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
          accent
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
        <p className="text-xl font-bold text-slate-900">{value}</p>
      </div>
      {active && (
        <motion.span
          layoutId="stat-active-dot"
          className="ml-auto h-2.5 w-2.5 rounded-full bg-emerald-500"
        />
      )}
    </motion.button>
  );
}