import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Gavel, PlusCircle, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HeroBadge, StatPill, getRoleGradient } from "./shared";

interface OrganizerHeroProps {
  user: any;
  stats: { created: number; drafts: number; live: number };
}

export function OrganizerHero({ user, stats }: OrganizerHeroProps) {
  const navigate = useNavigate();
  const gradient = getRoleGradient("ORGANIZER");

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 text-white shadow-2xl shadow-slate-900/20 sm:p-8 lg:p-10`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-teal-300/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-emerald-300/15 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 space-y-4">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <HeroBadge>
              <Gavel className="h-3.5 w-3.5" />
              Tournament Organizer
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
            Your command center for running world-class tournaments. Create events, manage registrations, and orchestrate seamless auctions.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-wrap gap-3 pt-1">
            <Button onClick={() => navigate("/tournaments/create")} className="!w-auto gap-2 bg-white text-emerald-700 hover:bg-emerald-50 shadow-lg">
              <PlusCircle className="h-4 w-4" />
              New Tournament
            </Button>
            <Button variant="ghost" onClick={() => navigate("/dashboard")} className="!w-auto gap-2 text-white hover:bg-white/15 hover:text-white border border-white/20">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 150 }}
          className="grid grid-cols-3 gap-2 sm:gap-3"
        >
          <StatPill label="Created" value={stats.created} delay={0.3} />
          <StatPill label="Drafts" value={stats.drafts} delay={0.35} />
          <StatPill label="Live" value={stats.live} delay={0.4} />
        </motion.div>
      </div>
    </div>
  );
}