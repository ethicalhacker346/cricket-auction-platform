import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  CheckCircle2,
  UserCheck,
  Trophy,
  Target,
  Activity,
  Building2,
  ClipboardList,
  Users,
  BarChart3,
  PlusCircle,
  Gavel,
  ShieldCheck,
} from "lucide-react";

/* ── Types ── */
interface RoadmapItem {
  icon: React.ElementType;
  title: string;
  desc: string;
  action?: { label: string; to: string };
  done?: boolean;
  color: string;
  ring: string;
}

interface RoadmapCardProps {
  user: any;
  playerProfile: any;
  franchise: any;
}

export function RoadmapCard({ user, playerProfile, franchise }: RoadmapCardProps) {
  const navigate = useNavigate();

  const items: RoadmapItem[] = useMemo(() => {
    const role = user?.role;
    const base: RoadmapItem[] = [];

    if (role === "PLAYER") {
      base.push(
        {
          icon: UserCheck,
          title: "Complete your profile",
          desc: "Add your stats, profile, and role.",
          done: !!playerProfile,
          action: playerProfile ? { label: "Edit", to: "/players/me/edit" } : { label: "Create", to: "/create-player" },
          color: "bg-sky-500",
          ring: "ring-sky-500/20",
        },
        { icon: Trophy, title: "Join a tournament", desc: "Register for an ongoing event.", color: "bg-sky-400", ring: "ring-sky-400/20" },
        { icon: Target, title: "Get drafted", desc: "Teams bid for you during the auction.", color: "bg-sky-300", ring: "ring-sky-300/20" },
        { icon: Activity, title: "Play & perform", desc: "Represent your team and climb the leaderboard.", color: "bg-slate-400", ring: "ring-slate-400/20" }
      );
    } else if (role === "FRANCHISE_OWNER") {
      base.push(
        {
          icon: Building2,
          title: "Create your franchise",
          desc: "Set name, logo, city, and branding.",
          done: !!franchise,
          action: franchise ? { label: "Edit", to: `/franchises/${franchise.id}/edit` } : { label: "Create", to: "/create-franchise" },
          color: "bg-amber-500",
          ring: "ring-amber-500/20",
        },
        { icon: ClipboardList, title: "Register for a tournament", desc: "Join an open tournament before registration closes.", color: "bg-amber-400", ring: "ring-amber-400/20" },
        { icon: Users, title: "Build your squad", desc: "Acquire players during the live auction.", color: "bg-amber-300", ring: "ring-amber-300/20" },
        { icon: BarChart3, title: "Track performance", desc: "Analyze wins, player stats, and standings.", color: "bg-slate-400", ring: "ring-slate-400/20" }
      );
    } else if (role === "ORGANIZER") {
      base.push(
        { icon: PlusCircle, title: "Create a tournament", desc: "Set up registration and auction pipeline.", color: "bg-emerald-500", ring: "ring-emerald-500/20" },
        { icon: UserCheck, title: "Approve franchises", desc: "Lock the auction pool before bidding starts.", color: "bg-emerald-400", ring: "ring-emerald-400/20" },
        { icon: Gavel, title: "Run the auction", desc: "Host a smooth, transparent bidding event.", color: "bg-emerald-300", ring: "ring-emerald-300/20" },
        { icon: Trophy, title: "Complete the season", desc: "Publish final results and standings.", color: "bg-slate-400", ring: "ring-slate-400/20" }
      );
    } else if (role === "ADMIN") {
      base.push(
        { icon: ShieldCheck, title: "Monitor platform", desc: "Oversee every tournament and auction.", color: "bg-violet-500", ring: "ring-violet-500/20" },
        { icon: Users, title: "User management", desc: "Review registrations and role assignments.", color: "bg-violet-400", ring: "ring-violet-400/20" },
        { icon: BarChart3, title: "Analytics", desc: "Study engagement and platform growth.", color: "bg-slate-400", ring: "ring-slate-400/20" }
      );
    }

    base.push({
      icon: Sparkles,
      title: "Explore auctions",
      desc: "Browse live and upcoming events.",
      color: "bg-slate-400",
      ring: "ring-slate-400/20",
    });

    return base;
  }, [user?.role, playerProfile, franchise]);

  const completedCount = items.filter((i) => i.done).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 14 }}
      className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md lg:col-span-2 flex flex-col"
    >
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
            <Sparkles className="h-4 w-4 text-emerald-500" />
          </span>
          Your Roadmap
        </h2>
        {completedCount > 0 && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {completedCount}/{items.length} done
          </span>
        )}
      </div>

      <div className="relative mt-6 flex-1">
        <div className="absolute left-[19px] top-2 bottom-2 w-px bg-slate-100" />

        <ul className="space-y-4">
          <AnimatePresence mode="popLayout">
            {items.map((step, idx) => {
              const Icon = step.icon;
              const isDone = step.done;
              return (
                <motion.li
                  key={step.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative flex items-start gap-4 rounded-xl p-2 transition-colors hover:bg-slate-50"
                >
                  <span
                    className={`relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isDone ? "bg-emerald-500" : step.color} ring-4 ${isDone ? "ring-emerald-500/20" : step.ring}`}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <Icon className="h-3 w-3 text-white" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium ${isDone ? "text-slate-500 line-through decoration-slate-300" : "text-slate-800"}`}>
                        {step.title}
                      </p>
                      {step.action && (
                        <button
                          onClick={() => navigate(step.action!.to)}
                          className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {step.action.label}
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">{step.desc}</p>
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </div>
    </motion.div>
  );
}