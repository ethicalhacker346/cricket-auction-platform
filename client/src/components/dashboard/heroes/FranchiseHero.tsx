import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, MapPin, Edit3, ArrowRight, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HeroBadge, StatPill, getRoleGradient } from "./shared";

interface FranchiseHeroProps {
  user: any;
  franchise: any;
}

export function FranchiseHero({ user, franchise }: FranchiseHeroProps) {
  const navigate = useNavigate();
  const hasFranchise = !!franchise;
  const gradient = getRoleGradient("FRANCHISE_OWNER");

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 text-white shadow-2xl shadow-slate-900/20 sm:p-8 lg:p-10`}>
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-orange-300/20 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-rose-300/15 blur-3xl" />
      </div>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 space-y-4">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <HeroBadge>
              <Building2 className="h-3.5 w-3.5" />
              Franchise Owner
            </HeroBadge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          >
            {hasFranchise ? franchise.name : user?.name}
          </motion.h1>

          {hasFranchise ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-2">
              {franchise.city && <HeroBadge><MapPin className="h-3 w-3" />{franchise.city}</HeroBadge>}
              <HeroBadge>@{franchise.slug}</HeroBadge>
              <HeroBadge className={franchise.isActive ? "bg-emerald-400/20 border-emerald-300/40" : "bg-amber-400/20 border-amber-300/40"}>
                {franchise.isActive ? "Active" : "Inactive"}
              </HeroBadge>
            </motion.div>
          ) : (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="max-w-md text-sm leading-relaxed text-white/80">
              You don&apos;t have a franchise yet. Create one to register for tournaments, build your squad, and dominate the auction floor.
            </motion.p>
          )}

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-wrap gap-3 pt-1">
            {hasFranchise ? (
              <>
                <Button onClick={() => navigate(`/franchises/${franchise.id}/edit`)} className="!w-auto gap-2 bg-white text-rose-700 hover:bg-rose-50 shadow-lg">
                  <Edit3 className="h-4 w-4" />
                  Edit Franchise
                </Button>
                {/* <Button variant="ghost" onClick={() => navigate(`/franchises/${franchise.id}`)} className="!w-auto gap-2 text-white hover:bg-white/15 hover:text-white border border-white/20">
                  View Page
                  <ArrowRight className="h-4 w-4" />
                </Button> */}
              </>
            ) : (
              <Button onClick={() => navigate("/create-franchise")} className="!w-auto gap-2 bg-white text-rose-700 hover:bg-rose-50 shadow-lg">
                <PlusCircle className="h-4 w-4" />
                Create Franchise
              </Button>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 150 }}
          className="flex shrink-0 flex-col items-center gap-4"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/20 text-4xl font-bold shadow-inner backdrop-blur-md ring-1 ring-white/30 sm:h-28 sm:w-28 sm:text-5xl overflow-hidden">
            {franchise?.logo ? (
              <img src={franchise.logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-12 w-12 text-white/90 sm:h-14 sm:w-14" />
            )}
          </div>
          {hasFranchise && (
            <div className="grid grid-cols-2 gap-2">
              <StatPill label="City" value={franchise.city ?? "—"} delay={0.35} />
              <StatPill label="Status" value={franchise.isActive ? "Active" : "Inactive"} delay={0.4} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}