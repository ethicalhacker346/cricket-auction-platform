import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, MapPin, UserCircle, Edit3, ArrowRight, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { HeroBadge, StatPill, getRoleGradient } from "./shared";

interface PlayerHeroProps {
  user: any;
  profile: any;
}

export function PlayerHero({ user, profile }: PlayerHeroProps) {
  const navigate = useNavigate();
  const hasProfile = !!profile;
  const gradient = getRoleGradient("PLAYER");

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${gradient} p-6 text-white shadow-2xl shadow-slate-900/20 sm:p-8 lg:p-10`}>
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-cyan-300/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute right-1/3 top-1/2 h-48 w-48 rounded-full bg-indigo-300/10 blur-2xl" />
      </div>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex-1 space-y-4">
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
            <HeroBadge>
              <Trophy className="h-3.5 w-3.5" />
              Player Account
            </HeroBadge>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
          >
            {hasProfile ? profile.fullName ?? user?.name : user?.name}
          </motion.h1>

          {hasProfile ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-2">
              {profile.primaryRole && <HeroBadge>{profile.primaryRole}</HeroBadge>}
              {profile.battingStyle && <HeroBadge>Bat: {profile.battingStyle}</HeroBadge>}
              {profile.bowlingStyle && <HeroBadge>Bowl: {profile.bowlingStyle}</HeroBadge>}
              {profile.nationality && <HeroBadge><MapPin className="h-3 w-3" />{profile.nationality}</HeroBadge>}
            </motion.div>
          ) : (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="max-w-md text-sm leading-relaxed text-white/80">
              You haven&apos;t completed your player profile yet. Set your role, style, and base price so teams can discover you at auctions.
            </motion.p>
          )}

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="flex flex-wrap gap-3 pt-1">
            {hasProfile ? (
              <>
                <Button onClick={() => navigate("/players/me/edit")} className="!w-auto gap-2 bg-white text-blue-700 hover:bg-blue-50 shadow-lg">
                  <Edit3 className="h-4 w-4" />
                  Edit Profile
                </Button>
                {/* <Button variant="ghost" onClick={() => navigate("/players/me")} className="!w-auto gap-2 text-white hover:bg-white/15 hover:text-white border border-white/20">
                  View Public
                  <ArrowRight className="h-4 w-4" />
                </Button> */}
              </>
            ) : (
              <Button onClick={() => navigate("/create-player")} className="!w-auto gap-2 bg-white text-blue-700 hover:bg-blue-50 shadow-lg">
                <PlusCircle className="h-4 w-4" />
                Create Player Profile
              </Button>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, rotate: -3 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.25, type: "spring", stiffness: 150 }}
          className="flex shrink-0 flex-col items-center gap-4"
        >
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-white/20 text-4xl font-bold shadow-inner backdrop-blur-md ring-1 ring-white/30 sm:h-28 sm:w-28 sm:text-5xl overflow-hidden">
            {profile?.profileImage ? (
              <img src={profile.profileImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserCircle className="h-12 w-12 text-white/90 sm:h-14 sm:w-14" />
            )}
          </div>
          {hasProfile && (
            <div className="grid grid-cols-2 gap-2">
              <StatPill label="Role" value={profile.primaryRole ?? "—"} delay={0.35} />
              <StatPill label="Status" value={profile.isActive ? "Active" : "Pending"} delay={0.4} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}