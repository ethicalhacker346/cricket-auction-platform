// src/pages/RegisterTeamPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { formatDistanceToNow, isPast, format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Building2,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Loader2,
  Send,
  ShieldAlert,
  Ban,
  Wallet,
  Users,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Info,
  MapPin,
  Crown,
  Sparkles,
  BadgeCheck,
  TrendingUp,
  Building,
  Landmark,
  Shield,
  Swords,
  ChevronRight,
  CalendarDays,
  Gavel,
  X,
  Plus,
  Check,
} from "lucide-react";
import { axiosClient } from "@/api/axiosClient";
import { useMyFranchises } from "@/hooks/useFranchise";
import { useMyTeamRegistration, useRegisterTeam, useTeams } from "@/hooks/useRegistration";
import { useAuthStore } from "@/store/authStore";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import type { ApiEnvelope } from "@/types/auth";
import type { Tournament } from "@/types/tournament";

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

interface Franchise {
  id: string;
  _id?: string;
  name: string;
  slug: string;
  city?: string;
  logo?: string;
  description?: string;
  primaryColor?: string;
  secondaryColor?: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface TeamRegistration {
  _id: string;
  franchiseId: Franchise | string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  name: string;
  wallet: {
    initialBudget: number;
    spentBudget: number;
    remainingBudget: number;
    reservedBudget: number;
  };
  roster: any[];
  rejectedReason?: string;
  createdAt: string;
  approvedAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Validation
// ═══════════════════════════════════════════════════════════════════════════════

const registerTeamSchema = z.object({
  franchiseId: z.string().min(1, "Select a franchise"),
  confirm: z.literal(true, {
    errorMap: () => ({ message: "You must confirm your registration" }),
  }),
});

type RegisterTeamFormValues = z.infer<typeof registerTeamSchema>;

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
        title: "Team approved!",
        description: "Your franchise has been cleared for the auction. Build your squad!",
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
        description: "Your team registration was not approved for this tournament.",
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
        description: "Your team registration is awaiting organizer verification.",
      };
  }
}

function getFranchiseInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getFranchiseColor(name: string) {
  const colors = [
    "from-violet-500 to-purple-600",
    "from-sky-500 to-blue-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
    "from-cyan-500 to-indigo-600",
    "from-lime-500 to-green-600",
    "from-fuchsia-500 to-violet-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

/* ═════════════════════════════════════════════════════════════════
   FRANCHISE LOGO BADGE — shows the logo when present, falls back to
   initials on a color gradient. Also recovers from a broken/404 logo
   URL by falling back the same way, instead of showing a broken-image
   glyph.
   ═════════════════════════════════════════════════════════════════ */
function FranchiseLogoBadge({
  name,
  logo,
  gradientClass,
  sizeClass,
  textSizeClass = "text-sm",
  padding = "p-1.5",
}: {
  name: string;
  logo?: string | null;
  gradientClass: string;
  /** e.g. "w-14 h-14" */
  sizeClass: string;
  textSizeClass?: string;
  padding?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = !!logo && !failed;

  return (
    <div
      className={cn(
        "rounded-xl flex items-center justify-center text-white font-bold shadow-md flex-shrink-0 overflow-hidden",
        sizeClass,
        textSizeClass,
        showLogo ? "bg-white" : cn("bg-gradient-to-br", gradientClass)
      )}
    >
      {showLogo ? (
        <img
          src={logo!}
          alt={name}
          onError={() => setFailed(true)}
          className={cn("w-full h-full object-contain", padding)}
        />
      ) : (
        getFranchiseInitials(name)
      )}
    </div>
  );
}

/** Extract franchise ID string from registration (handles populated or raw ObjectId) */
function getFranchiseIdFromReg(reg: TeamRegistration): string {
  if (!reg.franchiseId) return "";
  if (typeof reg.franchiseId === "object") {
    return reg.franchiseId.id ?? reg.franchiseId._id?.toString?.() ?? "";
  }
  return reg.franchiseId.toString();
}

/** Extract franchise name from registration */
function getFranchiseNameFromReg(reg: TeamRegistration): string {
  if (!reg.franchiseId) return reg.name;
  if (typeof reg.franchiseId === "object") {
    return reg.franchiseId.name ?? reg.name;
  }
  return reg.name;
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
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-900/40 via-slate-900/0 to-slate-900/0" />
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
      <div className="h-32 bg-white rounded-2xl shadow-sm border border-slate-100 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-48 bg-white rounded-2xl shadow-sm border border-slate-100 animate-pulse" />
        <div className="h-48 bg-white rounded-2xl shadow-sm border border-slate-100 animate-pulse" />
      </div>
      <div className="h-80 bg-white rounded-2xl shadow-sm border border-slate-100 animate-pulse" />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Franchise Card Component — For selection grid
// ═══════════════════════════════════════════════════════════════════════════════

interface FranchiseCardProps {
  franchise: Franchise;
  isSelected: boolean;
  isRegistered: boolean;
  onSelect: () => void;
}

function FranchiseCard({ franchise, isSelected, isRegistered, onSelect }: FranchiseCardProps) {
  const gradient = getFranchiseColor(franchise.name);
  const isDisabled = isRegistered;

  return (
    <motion.button
      whileHover={!isDisabled ? { y: -4, scale: 1.02 } : {}}
      whileTap={!isDisabled ? { scale: 0.98 } : {}}
      onClick={!isDisabled ? onSelect : undefined}
      className={cn(
        "relative w-full text-left rounded-2xl border-2 transition-all duration-300 overflow-hidden",
        isSelected
          ? "border-violet-500 shadow-lg shadow-violet-500/20 bg-violet-50/50"
          : isDisabled
          ? "border-slate-100 opacity-60 cursor-not-allowed bg-slate-50"
          : "border-slate-200 hover:border-violet-300 hover:shadow-md bg-white cursor-pointer"
      )}
    >
      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-3 right-3 w-6 h-6 bg-violet-500 rounded-full flex items-center justify-center shadow-md"
        >
          <Check className="w-3.5 h-3.5 text-white" />
        </motion.div>
      )}

      {/* Registered badge */}
      {isRegistered && (
        <div className="absolute top-3 right-3 px-2 py-1 bg-slate-200 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Already Registered
        </div>
      )}

      <div className="p-5">
        <div className="flex items-center gap-4">
          {/* Logo / Initials */}
          <FranchiseLogoBadge
            name={franchise.name}
            logo={franchise.logo}
            gradientClass={gradient}
            sizeClass="w-14 h-14"
            textSizeClass="text-lg"
            padding="p-1.5"
          />

          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-900 truncate">{franchise.name}</h4>
            <p className="text-xs text-slate-500 font-mono mt-0.5">/{franchise.slug}</p>
            {franchise.city && (
              <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" />
                {franchise.city}
              </p>
            )}
          </div>
        </div>

        {franchise.description && (
          <p className="text-xs text-slate-500 mt-3 line-clamp-2 leading-relaxed">
            {franchise.description}
          </p>
        )}
      </div>

      {/* Bottom accent bar for selected */}
      {isSelected && (
        <motion.div
          layoutId="selected-bar"
          className="h-1 bg-gradient-to-r from-violet-500 to-purple-500"
        />
      )}
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Existing Registration Card
// ═══════════════════════════════════════════════════════════════════════════════

function ExistingRegistrationCard({
  registration,
  tournament,
}: {
  registration: TeamRegistration;
  tournament: Tournament;
}) {
  const statusConfig = getStatusConfig(registration.status);
  const StatusIcon = statusConfig.icon;
  const franchiseName = getFranchiseNameFromReg(registration);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-white rounded-2xl shadow-lg shadow-slate-200/40 border overflow-hidden",
        statusConfig.border
      )}
    >
      <div className="px-6 py-5 flex items-start gap-4">
        <div className={cn("p-3 rounded-xl flex-shrink-0", statusConfig.bg)}>
          <StatusIcon className={cn("w-6 h-6", statusConfig.iconColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-slate-900 text-lg">
              {franchiseName}
            </h3>
            <span className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
              statusConfig.badgeBg,
              statusConfig.badgeText
            )}>
              {registration.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            {registration.status === "REJECTED" && registration.rejectedReason
              ? `Reason: ${registration.rejectedReason}`
              : statusConfig.description}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" />
              Purse: {formatCurrency(registration.wallet?.initialBudget ?? tournament.defaultPurse, tournament.currency)}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              Roster: {registration.roster?.length ?? 0} / {tournament.squadSize}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {formatDistanceToNow(new Date(registration.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// No Franchise State
// ═══════════════════════════════════════════════════════════════════════════════

function NoFranchiseState({
  tournament,
  tournamentId,
  isClosed,
  isDeadlinePassed,
  teamsFull,
}: {
  tournament: Tournament;
  tournamentId?: string;
  isClosed: boolean;
  isDeadlinePassed: boolean;
  teamsFull: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const blocked = isClosed || teamsFull;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-800/30 via-slate-900/0 to-slate-900/0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-800/20 via-slate-900/0 to-slate-900/0" />
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 via-sky-400 to-emerald-400 z-10" />
        <div className="relative max-w-5xl mx-auto px-6 py-12 md:py-16">
          <BackButton tournamentId={tournamentId} />
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-block px-3 py-1 bg-white/10 backdrop-blur rounded-full text-xs font-semibold tracking-wider uppercase text-slate-300 mb-4 border border-white/10">
              Team Registration
            </span>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-3">
              {tournament.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                {tournament.season ? `Season ${tournament.season}` : "Tournament"}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-500" />
                {tournament.maxTeams} teams
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-slate-500" />
                {tournament.squadSize} players per squad
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-10 md:py-14">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden"
        >
          <div className="relative px-8 py-14 sm:py-20 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-50/60 via-white to-transparent pointer-events-none" />
            <div className="relative max-w-lg mx-auto">
              <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-sky-600 flex items-center justify-center shadow-lg shadow-violet-500/25 mb-6">
                <Building2 className="w-10 h-10 text-white" />
              </div>

              {blocked ? (
                <>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">
                    {teamsFull ? "Tournament is full" : "Registration is closed"}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mb-10 leading-relaxed">
                    {teamsFull
                      ? `All ${tournament.maxTeams} team slots have been filled.`
                      : isDeadlinePassed
                      ? "The registration deadline has passed."
                      : "Team registration isn't open for this tournament yet."}{" "}
                    Set up a franchise now so you're ready for the next auction.
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-2xl font-bold text-slate-900 mb-3">
                    Create a franchise to register a team
                  </h3>
                  <p className="text-sm text-slate-500 max-w-sm mx-auto mb-10 leading-relaxed">
                    Your team's name, city and brand come from your franchise profile.
                    Set it up once, then use it to enter any tournament's auction.
                  </p>
                </>
              )}

              <div className="flex items-center justify-center flex-wrap gap-2 mb-10">
                {[
                  { icon: Landmark, label: "Franchise identity", color: "violet" },
                  { icon: MapPin, label: "Home city", color: "sky" },
                  { icon: Crown, label: "Ownership", color: "amber" },
                ].map((item) => (
                  <span
                    key={item.label}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border",
                      item.color === "violet" && "bg-violet-50 text-violet-600 border-violet-200",
                      item.color === "sky" && "bg-sky-50 text-sky-600 border-sky-200",
                      item.color === "amber" && "bg-amber-50 text-amber-600 border-amber-200"
                    )}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </span>
                ))}
              </div>

              <button
                onClick={() =>
                  navigate("/create-franchise", { state: { from: location.pathname } })
                }
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-sm bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.98] transition-all shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30"
              >
                <Building className="w-4 h-4" />
                Create Franchise
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

export function RegisterTeamPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isAuthorized = user?.role === "FRANCHISE_OWNER" || user?.role === "ADMIN";

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

  // ─── Fetch franchises ───
  // FIX: useMyFranchises now returns { data: Franchise[], pagination: {...} }
  // Access via franchisesData?.data (not .franchises)
  const { data: franchisesData, isLoading: loadingFranchises } = useMyFranchises({
    limit: 50,
  });
  const franchises: Franchise[] = franchisesData?.data ?? [];
  console.log("franchisesData", franchisesData);
  console.log("franchises", franchises);
  console.log(
    franchises.map(f => ({
        id: f.id,
        _id: f._id,
        name: f.name
    }))
  );

  // ─── Fetch ALL team registrations for this tournament (to show which franchises are already registered)
  const { data: allTeamsData, isLoading: loadingAllTeams } = useTeams(tournamentId!, {
    ownerId: "me",
    limit: 50,
  });
  const allMyRegistrations: TeamRegistration[] = allTeamsData?.data ?? [];

  // ─── Register mutation ───
  const {
    mutate: register,
    isPending,
    isSuccess,
    isError,
    error: registerError,
    reset: resetMutation,
  } = useRegisterTeam(tournamentId!);

  // ─── Redirect: unauthenticated ───
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // ─── Redirect: unauthorized ───
  useEffect(() => {
    if (user && !isAuthorized) {
      toast.error("Only Franchise Owners can register teams");
      navigate("/dashboard", { replace: true });
    }
  }, [user, isAuthorized, navigate]);

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
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterTeamFormValues>({
    resolver: zodResolver(registerTeamSchema),
    defaultValues: {
      franchiseId: "",
      confirm: false,
    },
  });

  const selectedFranchiseId = watch("franchiseId");

  // Determine which franchises are already registered
  const registeredFranchiseIds = useMemo(() => {
    return new Set(
      allMyRegistrations.map((reg) => getFranchiseIdFromReg(reg))
    );
  }, [allMyRegistrations]);

  const availableFranchises = useMemo(() => {
    return franchises.filter((f) => !registeredFranchiseIds.has(f.id));
  }, [franchises, registeredFranchiseIds]);

  // Auto-select first available franchise
  useEffect(() => {
    if (availableFranchises.length > 0 && !selectedFranchiseId) {
      setValue("franchiseId", availableFranchises[0].id);
    }
  }, [availableFranchises, selectedFranchiseId, setValue]);

  const selectedFranchise = franchises.find((f) => f.id === selectedFranchiseId);

  const onSubmit = (values: RegisterTeamFormValues) => {
    if (isError) resetMutation();
    register({ franchiseId: values.franchiseId });
  };

  // ─── Derived state ───
  const isRegistrationOpen =
    tournament?.teamRegistrationOpen ||
    tournament?.status === "TEAM_REGISTRATION_OPEN";

  const isDeadlinePassed = tournament?.registrationDeadline
    ? isPast(new Date(tournament.registrationDeadline))
    : false;

  const isClosed = !isRegistrationOpen || isDeadlinePassed;
  const teamsFull = tournament && tournament.teamsCount >= tournament.maxTeams;
  const hasAvailableFranchises = availableFranchises.length > 0;
  const allFranchisesRegistered = franchises.length > 0 && availableFranchises.length === 0;

  // ─── Loading state ───
  if (loadingTournament || loadingFranchises || loadingAllTeams) {
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
          <h2 className="text-xl font-bold text-slate-800">Tournament not found</h2>
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

  // ─── No franchise yet ───
  if (franchises.length === 0) {
    return (
      <NoFranchiseState
        tournament={tournament}
        tournamentId={tournamentId}
        isClosed={isClosed}
        isDeadlinePassed={isDeadlinePassed}
        teamsFull={!!teamsFull}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══════════════════════════════════════════════════════════════
          HERO — Clean, no overlap, proper spacing
         ═══════════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden bg-slate-900 text-white">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-400 via-sky-400 to-emerald-400 z-10" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-800/30 via-slate-900/0 to-slate-900/0" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-800/20 via-slate-900/0 to-slate-900/0" />

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
                Team Registration
              </span>
              {(isClosed || teamsFull) && (
                <span className="px-3 py-1 bg-red-500/15 backdrop-blur rounded-full text-xs font-semibold text-red-300 border border-red-500/20">
                  {teamsFull ? "Full" : "Closed"}
                </span>
              )}
              {allFranchisesRegistered && !isClosed && !teamsFull && (
                <span className="px-3 py-1 bg-emerald-500/15 backdrop-blur rounded-full text-xs font-semibold text-emerald-300 border border-emerald-500/20">
                  All Franchises Registered
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
                {tournament.teamsCount} / {tournament.maxTeams} teams
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT — Proper spacing, NO negative margins, NO overlap
         ═══════════════════════════════════════════════════════════════ */}
      <div className="max-w-5xl mx-auto px-6 py-8 md:py-12 space-y-6">

        {/* ─── Existing Registrations Banner ─── */}
        <AnimatePresence>
          {allMyRegistrations.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -10, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  Your Registered Teams
                </h3>
                <span className="text-xs text-slate-400">
                  {allMyRegistrations.length} of {franchises.length} franchises
                </span>
              </div>
              <div className="space-y-3">
                {allMyRegistrations.map((reg) => (
                  <ExistingRegistrationCard
                    key={reg._id}
                    registration={reg}
                    tournament={tournament}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── All Franchises Registered State ─── */}
        {allFranchisesRegistered && !isClosed && !teamsFull && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg shadow-slate-200/40 border border-emerald-100 overflow-hidden"
          >
            <div className="px-6 py-10 text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto border-2 border-emerald-100">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-800">
                All your franchises are registered
              </h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                You've registered all {franchises.length} of your franchises for this tournament.
                Manage your teams from the tournament dashboard.
              </p>
              <button
                onClick={() => navigate(`/tournaments/${tournamentId}`)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98]"
              >
                Go to Tournament
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ─── Two Column Layout: Franchise Selector | Registration Form ─── */}
        {(!allFranchisesRegistered || isClosed || teamsFull) && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* LEFT: Franchise Selector — Sticky on desktop */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-2"
            >
              <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/40 border border-slate-100 overflow-hidden lg:sticky lg:top-6">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-violet-500" />
                    <h2 className="font-semibold text-slate-800">Your Franchises</h2>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                    {availableFranchises.length} available
                  </span>
                </div>

                <div className="p-5 space-y-3 max-h-[600px] overflow-y-auto">
                  {/* Available franchises */}
                  {availableFranchises.length > 0 ? (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                        Select a franchise to register
                      </p>
                      {availableFranchises.map((franchise) => (
                        <FranchiseCard
                          key={franchise.id}
                          franchise={franchise}
                          isSelected={selectedFranchiseId === franchise.id}
                          isRegistered={false}
                          onSelect={() => setValue("franchiseId", franchise.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-400">
                        No available franchises to register.
                      </p>
                    </div>
                  )}

                  {/* Registered franchises (disabled) */}
                  {registeredFranchiseIds.size > 0 && (
                    <div className="pt-4 border-t border-slate-100">
                      <p className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-3">
                        Already registered
                      </p>
                      <div className="space-y-3 opacity-60">
                        {franchises
                          .filter((f) => registeredFranchiseIds.has(f.id))
                          .map((franchise) => (
                            <FranchiseCard
                              key={franchise.id}
                              franchise={franchise}
                              isSelected={false}
                              isRegistered={true}
                              onSelect={() => {}}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Create new franchise CTA */}
                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={() => navigate("/create-franchise")}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-500 hover:text-violet-600 hover:border-violet-300 hover:bg-violet-50/50 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      Create New Franchise
                    </button>
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
                  <Sparkles className="w-5 h-5 text-violet-500" />
                  <h2 className="font-semibold text-slate-800">Team Entry</h2>
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
                            ? "The registration deadline has passed. You can no longer register teams for this tournament."
                            : "Team registration is not currently open for this tournament. Check back later or contact the organizer."}
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

                  {/* Tournament Full State */}
                  {!isClosed && teamsFull && (
                    <div className="text-center py-12 space-y-5">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto border-2 border-slate-100">
                        <Users className="w-10 h-10 text-slate-300" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">
                          Tournament is full
                        </h3>
                        <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                          All {tournament.maxTeams} team slots have been filled.
                          You cannot register any more teams for this tournament.
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

                  {/* Registration Form */}
                  {!isClosed && !teamsFull && hasAvailableFranchises && (
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                      {/* Selected Franchise Preview */}
                      {selectedFranchise && (
                        <motion.div
                          key={selectedFranchise.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-5 bg-gradient-to-br from-violet-50/80 via-indigo-50/60 to-violet-50/80 rounded-xl border border-violet-100/80"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <Crown className="w-5 h-5 text-violet-600" />
                            <span className="font-semibold text-slate-800 text-sm">Selected Franchise</span>
                            <span className="ml-auto px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
                              Ready to Register
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <FranchiseLogoBadge
                              name={selectedFranchise.name}
                              logo={selectedFranchise.logo}
                              gradientClass={getFranchiseColor(selectedFranchise.name)}
                              sizeClass="w-12 h-12"
                              textSizeClass="text-sm"
                              padding="p-1"
                            />
                            <div>
                              <div className="font-bold text-slate-900">{selectedFranchise.name}</div>
                              <div className="text-xs text-slate-500 font-mono">/{selectedFranchise.slug}</div>
                            </div>
                          </div>
                        </motion.div>
                      )}

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
                            <Shield className="w-4 h-4 text-slate-400" />
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

                      {/* Purse Info */}
                      <div className="p-5 bg-gradient-to-br from-violet-50/80 via-sky-50/60 to-emerald-50/80 rounded-xl border border-violet-100/80">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Wallet className="w-5 h-5 text-violet-600" />
                            <span className="font-semibold text-slate-800 text-sm">Starting Purse</span>
                            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
                              Organizer Set
                            </span>
                          </div>
                          <span className="text-2xl font-bold text-violet-700">
                            {formatCurrency(tournament.defaultPurse, tournament.currency)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 leading-relaxed">
                          Your team will receive this budget for the auction. Use it wisely
                          to build a balanced squad of {tournament.squadSize} players. The
                          minimum bid increment is{" "}
                          {formatCurrency(tournament.minBidIncrement, tournament.currency)}.
                        </p>
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
                                <span className="text-slate-500">Franchise cannot be changed after registration</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                                <span className="text-slate-500">Team name and brand are derived from your franchise profile</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                                <span className="text-slate-500">Organizer approval required before auction entry</span>
                              </li>
                              <li className="flex items-start gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 flex-shrink-0" />
                                <span className="text-slate-500">Purse amount is set by the organizer and cannot be negotiated</span>
                              </li>
                            </ul>
                          </div>
                        </div>

                        <div className="border-t border-slate-200 pt-4">
                          <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              {...registerField("confirm")}
                              className="w-5 h-5 mt-0.5 rounded border-slate-300 text-violet-600 focus:ring-violet-500 focus:ring-offset-0 transition-colors"
                            />
                            <span className="text-sm font-medium text-slate-700 group-hover:text-slate-900 transition-colors leading-relaxed">
                              I confirm that my franchise details are accurate, I meet the eligibility requirements, and I agree to the tournament terms.
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
                          Your team will be reviewed by the organizer.
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          type="submit"
                          disabled={isPending || !selectedFranchise}
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
                              Register Team
                              <Send className="w-4 h-4" />
                            </>
                          )}
                        </motion.button>
                      </div>
                    </form>
                  )}

                  {/* No Available Franchises (but not all registered - edge case) */}
                  {!isClosed && !teamsFull && !hasAvailableFranchises && !allFranchisesRegistered && (
                    <div className="text-center py-12 space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto border-2 border-slate-100">
                        <Building2 className="w-8 h-8 text-slate-300" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-800">
                        No franchises available
                      </h3>
                      <p className="text-sm text-slate-500 max-w-sm mx-auto">
                        You don't have any franchises that can be registered for this tournament.
                        Create a new franchise to get started.
                      </p>
                      <button
                        onClick={() => navigate("/create-franchise")}
                        className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 active:scale-[0.98]"
                      >
                        <Plus className="w-4 h-4" />
                        Create Franchise
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
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
                Team Registered!
              </h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Your franchise <span className="font-semibold text-slate-700">{selectedFranchise?.name}</span> has been registered for <span className="font-semibold text-slate-700">{tournament.name}</span>. The organizer will review your entry shortly.
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