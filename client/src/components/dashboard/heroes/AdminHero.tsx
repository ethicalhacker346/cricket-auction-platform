import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { HeroBadge, getRoleGradient } from "./shared";

interface AdminHeroProps {
  user: any;
}

export function AdminHero({ user }: AdminHeroProps) {
  const gradient = getRoleGradient("ADMIN");

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 text-white shadow-2xl shadow-slate-900/20 sm:p-8 lg:p-10`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-violet-300/15 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 space-y-4">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <HeroBadge>
              <Crown className="h-3.5 w-3.5" />
              Platform Administrator
            </HeroBadge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          >
            {user?.name}
          </motion.h1>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="max-w-lg text-sm leading-relaxed text-white/80">
            Oversee every tournament, auction, and user on the platform. Monitor system health and ensure everything runs smoothly.
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 150 }}
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-4xl font-bold shadow-inner backdrop-blur-md ring-1 ring-white/30 sm:h-28 sm:w-28"
        >
          <Crown className="h-12 w-12 text-white/90 sm:h-14 sm:w-14" />
        </motion.div>
      </div>
    </div>
  );
}