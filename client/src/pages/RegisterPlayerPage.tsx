// src/pages/RegisterPlayerPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDistanceToNow, isPast, format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  UserCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  Send,
  ShieldAlert,
  Ban,
  Wallet,
  ArrowRight,
  ArrowLeft,
  Info,
  Sword,
  Target,
  Zap,
  Shield,
  Sparkles,
  BadgeCheck,
  UserPlus,
  IdCard,
  ChevronRight,
  CalendarDays,
  MapPin,
  Users,
  Gavel,
  X,
} from "lucide-react";
import { axiosClient } from "@/api/axiosClient";
import { usePlayerMe } from "@/hooks/usePlayers";
import { useMyPlayerRegistration, useRegisterPlayer } from "@/hooks/useRegistration";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import type { ApiEnvelope } from "@/types/auth";
import type { Tournament } from "@/types/tournament";

// ═══════════════════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════════════════

const registerPlayerSchema = z.object({
  confirm: z.literal(true, {
    errorMap: () => ({ message: "You must confirm your details are accurate" }),
  }),
});

type RegisterPlayerFormValues = z.infer<typeof registerPlayerSchema>;

// ═══════════════════════════════════════════════════════════════════════════════
// Role Meta
// ═══════════════════════════════════════════════════════════════════════════════

const ROLE_META: Record<string, { icon: React.ElementType; color: string; bg: string; border: string; gradient: string }> = {
  BATSMAN: { 
    icon: Sword, 
    color: "text-amber-700", 
    bg: "bg-amber-50", 
    border: "border-amber-200",
    gradient: "from-amber-500 to-orange-600" 
  },
  BOWLER: { 
    icon: Target, 
    color: "text-emerald-700", 
    bg: "bg-emerald-50", 
    border: "border-emerald-200",
    gradient: "from-emerald-500 to-teal-600" 
  },
  ALL_ROUNDER: { 
    icon: Zap, 
    color: "text-violet-700", 
    bg: "bg-violet-50", 
    border: "border-violet-200",
    gradient: "from-violet-500 to-purple-600" 
  },
  WICKET_KEEPER: { 
    icon: Shield, 
    color: "text-sky-700", 
    bg: "bg-sky-50", 
    border: "border-sky-200",
    gradient: "from-sky-500 to-blue-600" 
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════

function formatCurrency(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

function computeAge(dob?: string) {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function getStatusConfig(status?: string) {
  switch (status) {
    case "APPROVED":
      return {
        icon: CheckCircle2,
        iconColor: "text-emerald-600",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        badgeBg: "bg-emerald-100",
        badgeText: "text-emerald-800",
        title: "You're registered!",
        description: "Your player profile has been approved for this tournament. Prepare for the auction!",
      };
    case "REJECTED":
      return {
        icon: Ban,
        iconColor: "text-red-600",
        bg: "bg-red-50",
        border: "border-red-200",
        badgeBg: "bg-red-100",
        badgeText: "text-red-800",
        title: "Registration rejected",
        description: "Your registration was not approved for this tournament.",
      };
    default:
      return {
        icon: Clock,
        iconColor: "text-amber-600",
        bg: "bg-amber-50",
        border: "border-amber-200",
        badgeBg: "bg-amber-100",
        badgeText: "text-amber-800",
        title: "Registration pending",
        description: "Your registration is awaiting organizer verification. You'll be notified once reviewed.",
      };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════════

function BackButton({ tournamentId }: { tournamentId?: string }) {
  const navigate = useNavigate();
  return (
    <motion.button
      whileHover={{ x: -2 }}
      whileTap={{ scale: 0.97 }}
      type="button"
      onClick={() =>
        tournamentId ? navigate(`/tournaments/${tournamentId}`) : navigate(-1)
      }
      className="group inline-flex items-center gap-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Back to tournament
    </motion.button>
  );
}

function HeroSkeleton() {
  return (
    <div className="relative overflow-hidden bg-slate-900">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/40 via-slate-900/0 to-slate-900/0" />
      <div className="relative max-w-5xl mx-auto px-6 py-16 md:py-20">
        <div className="h-4 w-32 bg-white/10 rounded animate-pulse mb-6" />
        <div className="h-10 w-3/4 bg-white/10 rounded animate-pulse mb-3" />
        <div className="h-5 w-1/2 bg-white/10 rounded animate-pulse" />
      </div>
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-6">
      <div className="h-40 bg-white rounded-2xl shadow-sm border border-slate-100 animate-pulse" />
      <div className="h-64 bg-white rounded-2xl shadow-sm border border-slate-100 animate-pulse" />
      <div className="h-80 bg-white rounded-2xl shadow-sm border border-slate-100 animate-pulse" />
    </div>
  );
}

function NoPlayerProfileState({
  tournament,
  tournamentId,
  isClosed,
  isDeadlinePassed,
}: {
  tournament: Tournament;
  tournamentId?: string;
  isClosed: boolean;
  isDeadlinePassed: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/50 via-slate-900/0 to-slate-900/0" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400" />
        <div className="relative max-w-5xl mx-auto px-6 py-12 md:py-16">
          <BackButton tournamentId={tournamentId} />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-3 py-1 bg-white/10 backdrop-blur rounded-full text-xs font-semibold tracking-wider uppercase text-slate-300 mb-4 border border-white/10">
              Player Registration
            </span>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
              {tournament.name}
            </h1>
            <p className="text-slate-400 flex items-center gap-2 text-sm md:text-base">
              <Trophy className="w-4 h-4" />
              {tournament.season && `Season ${tournament.season} • `}
              Auction on{" "}
              {tournament.auctionDate ? format(new Date(tournament.auctionDate), "PPP") : "TBD"}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content — NO NEGATIVE MARGIN, proper spacing */}
      <div className="max-w-5xl mx-auto px-6 py-10 md:py-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden"
        >
          <div className="relative px-8 py-14 sm:py-20 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/60 via-white to-transparent pointer-events-none" />
            <div className="relative max-w-lg mx-auto">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 mb-6">
                <UserPlus className="w-10 h-10 text-white" />
              </div>

              {isClosed ? (
                <>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">
                    Registration is closed
                  </h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mb-8 leading-relaxed">
                    {isDeadlinePassed
                      ? "The registration deadline for this tournament has passed."
                      : "Player registration isn't open for this tournament yet."}{" "}
                    You're also missing a player profile — set one up now so
                    you're ready the moment entries open elsewhere.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">
                    Create your player profile to enter
                  </h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mb-10 leading-relaxed">
                    Organizers need to know who's walking out to bat. Set up
                    your role, batting and bowling style once, and reuse the
                    same profile for every auction you enter.
                  </p>
                </>
              )}

              <div className="flex items-center justify-center flex-wrap gap-2 mb-10">
                {Object.entries(ROLE_META).map(([role, meta]) => {
                  const Icon = meta.icon;
                  return (
                    <span
                      key={role}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
                        meta.bg,
                        meta.color,
                        meta.border
                      )}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {role.replace("_", " ")}
                    </span>
                  );
                })}
              </div>

              <button
                onClick={() =>
                  navigate("/create-player", { state: { from: location.pathname } })
                }
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30"
              >
                <IdCard className="w-4 h-4" />
                Create Player Profile
                <ChevronRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-slate-400 mt-4">Takes about 2 minutes</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════

export function RegisterPlayerPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  // Tracks a broken/404 profileImage URL so we fall back to the icon
  // placeholder instead of showing a broken-image glyph.
  const [avatarFailed, setAvatarFailed] = useState(false);

  // ─── Fetch tournament ───
  const {
    data: tournament,
    isLoading: loadingTournament,
    error: tournamentError,
  } = useQuery({
    queryKey: ["tournament", tournamentId],
    queryFn: async () => {
      const { data } = await axiosClient.get<ApiEnvelope<Tournament>>(
        `/tournaments/${tournamentId}`
      );
      return data.data;
    },
    enabled: !!tournamentId,
    staleTime: 5 * 60 * 1000,
  });

  // ─── Fetch player profile ───
  const { data: player, isLoading: loadingPlayer } = usePlayerMe();

  // ─── Fetch existing registration ───
  const { data: existingReg, isLoading: loadingReg } = useMyPlayerRegistration(
    tournamentId!
  );

  // ─── Register mutation ───
  const { 
    mutate: register, 
    isPending, 
    isSuccess,
    isError,
    error: registerError,
    reset: resetMutation 
  } = useRegisterPlayer(tournamentId!);

  // ─── Redirect: unauthenticated ───
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // ─── Success: show modal then redirect ───
  useEffect(() => {
    if (isSuccess) {
      setShowSuccessModal(true);
      const timer = setTimeout(() => {
        setShowSuccessModal(false);
        navigate(`/tournaments/${tournamentId}`, { replace: true });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, navigate, tournamentId]);

  // ─── Form ───
  const {
    register: registerField,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterPlayerFormValues>({
    resolver: zodResolver(registerPlayerSchema),
    defaultValues: { confirm: false },
  });

  const onSubmit = (_values: RegisterPlayerFormValues) => {
    // Reset any previous error state before submitting
    if (isError) resetMutation();
    register({}); 
  };

  // ─── Derived state ───
  const isRegistrationOpen =
    tournament?.playerRegistrationOpen ||
    tournament?.status === "PLAYER_REGISTRATION_OPEN";

  const isDeadlinePassed = tournament?.registrationDeadline
    ? isPast(new Date(tournament.registrationDeadline))
    : false;

  const isClosed = !isRegistrationOpen || isDeadlinePassed;

  const roleMeta = player?.primaryRole ? ROLE_META[player.primaryRole] : null;
  const RoleIcon = roleMeta?.icon ?? UserCheck;

  const statusConfig = getStatusConfig(existingReg?.status);
  const StatusIcon = statusConfig.icon;

  // ─── Loading state ───
  if (loadingTournament || loadingPlayer || loadingReg) {
    return (
      <div className="min-h-screen bg-slate-50">
        <HeroSkeleton />
        <ContentSkeleton />
      </div>
    );
  }

  // ─── Tournament error ───
  if (tournamentError || !tournament) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-5 max-w-sm"
        >
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto border border-red-100">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800">
            Tournament not found
          </h2>
          <p className="text-sm text-slate-500">
            We couldn't locate the tournament you're looking for. It may have been removed or the link is incorrect.
          </p>
          <button
            onClick={() => navigate("/tournaments")}
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/20"
          >
            Browse Tournaments
          </button>
        </motion.div>
      </div>
    );
  }

  // ─── No player profile yet ───
  if (!player) {
    return (
      <NoPlayerProfileState
        tournament={tournament}
        tournamentId={tournamentId}
        isClosed={isClosed}
        isDeadlinePassed={isDeadlinePassed}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══════════════════════════════════════════════════════════════
          HERO — Clean, no overlap, proper spacing
         ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden bg-slate-900 text-white">
        {/* Subtle top gradient line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-emerald-400 to-sky-400 z-10" />

        {/* Background glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-800/30 via-slate-900/0 to-slate-900/0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-violet-800/20 via-slate-900/0 to-slate-900/0" />

        <div className="relative max-w-5xl mx-auto px-6 py-10 md:py-14">
          <BackButton tournamentId={tournamentId} />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mt-6"
          >
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <span className="px-3 py-1 bg-white/10 backdrop-blur rounded-full text-xs font-semibold tracking-wider uppercase text-slate-300 border border-white/10">
                Player Registration
              </span>
              {isClosed ? (
                <span className="px-3 py-1 bg-red-500/15 backdrop-blur rounded-full text-xs font-semibold text-red-300 border border-red-500/20">
                  Closed
                </span>
              ) : existingReg ? (
                <span className={cn(
                  "px-3 py-1 backdrop-blur rounded-full text-xs font-semibold border",
                  statusConfig.badgeBg,
                  statusConfig.badgeText,
                  statusConfig.border
                )}>
                  {existingReg.status}
                </span>
              ) : (
                <span className="px-3 py-1 bg-emerald-500/15 backdrop-blur rounded-full text-xs font-semibold text-emerald-300 border border-emerald-500/20">
                  Open
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight mb-3">
              {tournament.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                {tournament.season ? `Season ${tournament.season}` : "Tournament"}
              </span>
              {tournament.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  {tournament.venue}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-slate-500" />
                Auction {tournament.auctionDate ? format(new Date(tournament.auctionDate), "PPP") : "TBD"}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-500" />
                {tournament.maxTeams} teams
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT — Proper spacing, NO negative margins, NO overlap
         ═══════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-6 py-8 md:py-12 space-y-6">

        {/* ─── Already Registered Banner ─── */}
        <AnimatePresence>
          {existingReg && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="overflow-hidden"
            >
              <div className={cn(
                "bg-white rounded-2xl shadow-lg shadow-slate-200/40 border overflow-hidden",
                statusConfig.border
              )}>
                <div className="px-6 py-5 flex items-start gap-4">
                  <div className={cn("p-3 rounded-xl flex-shrink-0", statusConfig.bg)}>
                    <StatusIcon className={cn("w-6 h-6", statusConfig.iconColor)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 text-lg">
                      {statusConfig.title}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                      {existingReg.status === "REJECTED" && existingReg.rejectedReason
                        ? `Reason: ${existingReg.rejectedReason}`
                        : statusConfig.description}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" />
                        Base price: {formatCurrency(existingReg.basePrice ?? 100, tournament.currency)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <BadgeCheck className="w-3.5 h-3.5" />
                        Role: {existingReg.primaryRole?.replace("_", " ")}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        Submitted {formatDistanceToNow(new Date(existingReg.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex-shrink-0",
                    statusConfig.badgeBg,
                    statusConfig.badgeText
                  )}>
                    {existingReg.status}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Two Column Layout: Profile | Registration ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* LEFT: Player Profile Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-2"
          >
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/40 border border-slate-100 overflow-hidden sticky top-6">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-indigo-500" />
                  <h2 className="font-semibold text-slate-800">Player Profile</h2>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                  Verified
                </span>
              </div>

              <div className="p-6">
                {/* Avatar & Name */}
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="relative mb-4">
                    <div className="w-28 h-28 rounded-3xl overflow-hidden border-2 border-slate-100 bg-slate-50 shadow-inner">
                      {player?.profileImage && !avatarFailed ? (
                        <img
                          src={player.profileImage}
                          alt={player.fullName}
                          onError={() => setAvatarFailed(true)}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                          <Trophy className="w-10 h-10 text-slate-300" />
                        </div>
                      )}
                    </div>
                    <div className={cn(
                      "absolute -bottom-2 -right-2 p-2 rounded-xl border-[3px] border-white shadow-md",
                      roleMeta?.bg ?? "bg-slate-50"
                    )}>
                      <RoleIcon className={cn("w-5 h-5", roleMeta?.color ?? "text-slate-500")} />
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-900">{player?.fullName}</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    {player?.nationality}
                    {player?.nationality && player?.dateOfBirth && " • "}
                    {computeAge(player?.dateOfBirth) ?? null}
                    {player?.dateOfBirth && " years old"}
                  </p>
                </div>

                {/* Role & Styles */}
                <div className="space-y-3">
                  <div className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border",
                    roleMeta?.bg ?? "bg-slate-50",
                    roleMeta?.border ?? "border-slate-100"
                  )}>
                    <div className={cn("p-2 rounded-lg bg-white/80", roleMeta?.color ?? "text-slate-500")}>
                      <RoleIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-800">
                        {player?.primaryRole?.replace("_", " ")}
                      </div>
                      <div className="text-xs text-slate-500">Primary Role</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {player?.battingStyle && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Batting</div>
                        <div className="text-sm font-semibold text-slate-800">{player.battingStyle}</div>
                      </div>
                    )}
                    {player?.bowlingStyle && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bowling</div>
                        <div className="text-sm font-semibold text-slate-800">{player.bowlingStyle}</div>
                      </div>
                    )}
                  </div>

                  {player?.bio && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">About</div>
                      <p className="text-sm text-slate-600 leading-relaxed">{player.bio}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* RIGHT: Registration Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-3"
          >
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/40 border border-slate-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h2 className="font-semibold text-slate-800">Auction Entry</h2>
              </div>

              <div className="p-6 md:p-8">
                {/* Closed State */}
                {isClosed && (
                  <div className="text-center py-12 space-y-5">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border-2 border-slate-100">
                      <Ban className="w-10 h-10 text-slate-300" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">
                        Registration is closed
                      </h3>
                      <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                        {isDeadlinePassed
                          ? "The registration deadline has passed. You can no longer register for this tournament."
                          : "Player registration is not currently open for this tournament. Check back later or contact the organizer."}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate("/tournaments")}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98]"
                    >
                      Browse Other Tournaments
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Already Registered State */}
                {!isClosed && existingReg && (
                  <div className="text-center py-12 space-y-5">
                    <div className={cn(
                      "w-20 h-20 rounded-full flex items-center justify-center mx-auto border-2",
                      existingReg.status === "APPROVED" ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"
                    )}>
                      {existingReg.status === "APPROVED" ? (
                        <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                      ) : (
                        <Clock className="w-10 h-10 text-amber-500" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-2">
                        {existingReg.status === "APPROVED" 
                          ? "You're all set!" 
                          : "Registration submitted"}
                      </h3>
                      <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                        {existingReg.status === "APPROVED"
                          ? "Your registration has been approved. You're cleared for the auction. Good luck!"
                          : "Your registration is under review. The organizer will verify your details shortly."}
                      </p>
                    </div>
                    <button
                      onClick={() => navigate(`/tournaments/${tournamentId}`)}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98]"
                    >
                      Return to Tournament
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Registration Form */}
                {!isClosed && !existingReg && (
                  <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                    {/* Tournament Info Summary */}
                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                      <div className="flex items-center gap-2 mb-3">
                        <Gavel className="w-5 h-5 text-indigo-500" />
                        <span className="font-semibold text-slate-800 text-sm">Tournament Details</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Users className="w-4 h-4 text-slate-400" />
                          <span>{tournament.maxTeams} teams competing</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <Wallet className="w-4 h-4 text-slate-400" />
                          <span>Squad size: {tournament.squadSize} players</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-600">
                          <CalendarDays className="w-4 h-4 text-slate-400" />
                          <span>Auction: {tournament.auctionDate ? format(new Date(tournament.auctionDate), "PPP") : "TBD"}</span>
                        </div>
                        {tournament.registrationDeadline && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Clock className="w-4 h-4 text-slate-400" />
                            <span>
                              Deadline: {format(new Date(tournament.registrationDeadline), "PPP")}
                              {isDeadlinePassed && (
                                <span className="ml-1.5 text-red-600 font-medium">(Passed)</span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Base Price Info */}
                    <div className="p-5 bg-gradient-to-br from-amber-50/80 via-orange-50/60 to-amber-50/80 rounded-xl border border-amber-100/80">
                      <div className="flex items-center gap-2 mb-3">
                        <Wallet className="w-5 h-5 text-amber-600" />
                        <span className="font-semibold text-slate-800 text-sm">Base Price</span>
                        <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
                          Default
                        </span>
                      </div>
                      <div className="text-2xl font-bold text-slate-900 mb-2">
                        {formatCurrency(100, tournament.currency)}
                      </div>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        This is your starting auction price. The organizer may adjust this during review. 
                        Your final selling price will be determined by live bidding during the auction.
                      </p>
                    </div>

                    {/* Role Confirmation */}
                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2.5 rounded-xl", roleMeta?.bg ?? "bg-slate-100")}>
                          <RoleIcon className={cn("w-5 h-5", roleMeta?.color ?? "text-slate-500")} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-800">
                            Primary Role: {player?.primaryRole?.replace("_", " ")}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Pulled from your player profile. Contact support if you need to update it.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Rules & Confirmation */}
                    <div className="p-5 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-slate-600 space-y-2">
                          <p className="font-medium text-slate-800">Before you register</p>
                          <ul className="space-y-2">
                            <li className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                              <span className="text-slate-500">You must be at least 15 years old to participate</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                              <span className="text-slate-500">Base price is set by the tournament organizer and may be adjusted during review</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                              <span className="text-slate-500">Organizer approval is required before you're entered into the auction pool</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                              <span className="text-slate-500">You may only register once per tournament</span>
                            </li>
                          </ul>
                        </div>
                      </div>

                      <div className="border-t border-slate-200 pt-4">
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            {...registerField("confirm")}
                            className="w-5 h-5 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 transition-colors"
                          />
                          <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors leading-relaxed">
                            I confirm that all my profile details are accurate, I meet the eligibility requirements, and I agree to the tournament rules.
                          </span>
                        </label>
                        {errors.confirm && (
                          <motion.span
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-xs text-red-600 block mt-2 ml-8 font-medium"
                          >
                            {errors.confirm.message}
                          </motion.span>
                        )}
                      </div>
                    </div>

                    {/* Error from mutation */}
                    <AnimatePresence>
                      {isError && registerError && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                            <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-red-700">
                              <p className="font-semibold">Registration failed</p>
                              <p className="text-red-600/80 mt-0.5">
                                {registerError instanceof Error ? registerError.message : "Something went wrong. Please try again."}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Submit */}
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-slate-400 hidden sm:block">
                        Your profile will be reviewed by the organizer.
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        type="submit"
                        disabled={isPending}
                        className={cn(
                          "inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm transition-all",
                          "bg-slate-900 text-white hover:bg-slate-800",
                          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
                          "shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30"
                        )}
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            Submit Registration
                            <Send className="w-4 h-4" />
                          </>
                        )}
                      </motion.button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          SUCCESS MODAL — Full-screen overlay with redirect
         ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center"
            >
              <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-emerald-100">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                </motion.div>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">
                Registration Submitted!
              </h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Your registration for <span className="font-semibold text-slate-700">{tournament.name}</span> has been submitted successfully. The organizer will review your profile shortly.
              </p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mb-6 overflow-hidden">
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.5, ease: "linear" }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
              <p className="text-xs text-slate-400">
                Redirecting you to the tournament page...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}