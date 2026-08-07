import { motion } from "framer-motion";

/* ── Theme ── */
export const ROLE_GRADIENTS = {
  ADMIN: "from-violet-600 via-purple-600 to-fuchsia-700",
  ORGANIZER: "from-emerald-600 via-teal-600 to-cyan-700",
  FRANCHISE_OWNER: "from-amber-500 via-orange-500 to-rose-600",
  PLAYER: "from-sky-500 via-blue-600 to-indigo-700",
} as const;

export const getRoleGradient = (role?: string) =>
  ROLE_GRADIENTS[role as keyof typeof ROLE_GRADIENTS] ?? ROLE_GRADIENTS.PLAYER;

/* ── Shared Sub-components ── */
export function HeroBadge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-xs font-semibold text-white/95 backdrop-blur-md ${className}`}
    >
      {children}
    </span>
  );
}

export function StatPill({ label, value, delay = 0 }: { label: string; value: string | number; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 200 }}
      className="flex flex-col rounded-xl bg-white/10 p-2.5 text-center backdrop-blur-sm ring-1 ring-white/10 sm:p-3"
    >
      <span className="text-lg font-bold text-white sm:text-xl">{value}</span>
      <span className="text-[10px] font-medium uppercase tracking-wider text-white/60">{label}</span>
    </motion.div>
  );
}