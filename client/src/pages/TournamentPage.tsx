import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format, isPast, differenceInDays } from "date-fns";
import {
  CalendarClock,
  Gavel,
  MapPin,
  Trophy,
  Users,
  Shield,
  Clock,
  AlertTriangle,
  ChevronRight,
  DollarSign,
  Activity,
  ArrowLeft,
  Zap,
  RefreshCw,
} from "lucide-react";
import { Tabs } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { OverviewTab } from "@/components/tournament/OverviewTab";
import { TeamsTab } from "@/components/tournament/TeamsTab";
import { PlayersTab } from "@/components/tournament/PlayersTab";
import {
  OrganizerPanel,
  FranchisePanel,
  PlayerPanel,
  AdminNotice,
  GuestNotice,
} from "@/components/tournament/ActionPanel";
import { AuctionModule, canShowAuctionModule, type TournamentAuctionDefaults } from "@/components/tournament/AuctionModule";
import { useAuction, useAuctionRounds } from "@/features/auction/hooks/index.hook";
import { useTournament } from "@/hooks/useTournaments";
import { useAuthStore } from "@/store/authStore";
import { STATUS_META } from "@/lib/constants/tournament";
import { cn } from "@/lib/utils";

/* ═════════════════════════════════════════════════════════════════
   STATUS THEME
   ═════════════════════════════════════════════════════════════════ */
const STATUS_THEME: Record<
  string,
  { gradient: string; badge: string; dot: string; text: string; glow: string }
> = {
  DRAFT: {
    gradient: "from-slate-800 via-slate-900 to-slate-950",
    badge: "bg-slate-100 text-slate-700 ring-slate-200",
    dot: "bg-slate-400",
    text: "text-slate-300",
    glow: "shadow-slate-500/10",
  },
  PLAYER_REGISTRATION_OPEN: {
    gradient: "from-emerald-900 via-slate-900 to-emerald-950",
    badge: "bg-emerald-100 text-emerald-700 ring-emerald-200",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    glow: "shadow-emerald-500/10",
  },
  TEAM_REGISTRATION_OPEN: {
    gradient: "from-violet-900 via-slate-900 to-violet-950",
    badge: "bg-violet-100 text-violet-700 ring-violet-200",
    dot: "bg-violet-400",
    text: "text-violet-300",
    glow: "shadow-violet-500/10",
  },
  TEAMS_APPROVED: {
    gradient: "from-amber-900 via-slate-900 to-amber-950",
    badge: "bg-amber-100 text-amber-700 ring-amber-200",
    dot: "bg-amber-400",
    text: "text-amber-300",
    glow: "shadow-amber-500/10",
  },
  AUCTION_SCHEDULED: {
    gradient: "from-sky-900 via-slate-900 to-sky-950",
    badge: "bg-sky-100 text-sky-700 ring-sky-200",
    dot: "bg-sky-400",
    text: "text-sky-300",
    glow: "shadow-sky-500/10",
  },
  AUCTION_RUNNING: {
    gradient: "from-rose-900 via-slate-900 to-rose-950",
    badge: "bg-rose-100 text-rose-700 ring-rose-200",
    dot: "bg-rose-400",
    text: "text-rose-300",
    glow: "shadow-rose-500/10",
  },
  AUCTION_COMPLETED: {
    gradient: "from-teal-900 via-slate-900 to-teal-950",
    badge: "bg-teal-100 text-teal-700 ring-teal-200",
    dot: "bg-teal-400",
    text: "text-teal-300",
    glow: "shadow-teal-500/10",
  },
  TOURNAMENT_COMPLETED: {
    gradient: "from-indigo-900 via-slate-900 to-indigo-950",
    badge: "bg-indigo-100 text-indigo-700 ring-indigo-200",
    dot: "bg-indigo-400",
    text: "text-indigo-300",
    glow: "shadow-indigo-500/10",
  },
  CANCELLED: {
    gradient: "from-red-900 via-slate-900 to-red-950",
    badge: "bg-red-100 text-red-700 ring-red-200",
    dot: "bg-red-400",
    text: "text-red-300",
    glow: "shadow-red-500/10",
  },
};

const FALLBACK_THEME = STATUS_THEME.DRAFT;

function getTheme(status?: string) {
  if (!status) return FALLBACK_THEME;
  return STATUS_THEME[status] ?? FALLBACK_THEME;
}

/* ═════════════════════════════════════════════════════════════════
   LIVE PULSE
   ═════════════════════════════════════════════════════════════════ */
function LivePulse() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
    </span>
  );
}

/* ═════════════════════════════════════════════════════════════════
   STAT CARD
   ═════════════════════════════════════════════════════════════════ */
function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50">
          <Icon className="h-5 w-5 text-slate-500" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
      {subtext && <p className="mt-2 text-xs text-slate-500">{subtext}</p>}
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   PROGRESS BAR
   ═════════════════════════════════════════════════════════════════ */
function ProgressBar({ current, max, color = "bg-emerald-500" }: { current: number; max: number; color?: string }) {
  const pct = Math.min((current / Math.max(max, 1)) * 100, 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   CREST — shows the logo when present, falls back to a themed trophy
   badge. Never a broken-image glyph or empty gap.
   ═════════════════════════════════════════════════════════════════ */
function TournamentCrest({ logo, name }: { logo?: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const showLogo = !!logo && !failed;

  return (
    <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-lg backdrop-blur-md md:h-24 md:w-24">
      {showLogo ? (
        <img
          src={logo!}
          alt={`${name} logo`}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-2.5"
        />
      ) : (
        <Trophy className="h-9 w-9 text-white/70 md:h-10 md:w-10" />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   HERO
   ═════════════════════════════════════════════════════════════════ */
function TournamentHero({ tournament, theme }: { tournament: any; theme: ReturnType<typeof getTheme> }) {
  const isRegistrationOpen = tournament.playerRegistrationOpen || tournament.teamRegistrationOpen;
  const isDeadlinePassed = tournament.registrationDeadline
    ? isPast(new Date(tournament.registrationDeadline))
    : false;
  const daysToDeadline = tournament.registrationDeadline
    ? differenceInDays(new Date(tournament.registrationDeadline), new Date())
    : null;
  const isDeadlineSoon = daysToDeadline !== null && daysToDeadline >= 0 && daysToDeadline <= 3;
  const isLive = tournament.status === "AUCTION_RUNNING";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "relative overflow-hidden rounded-3xl bg-gradient-to-br p-8 text-white shadow-xl md:p-10",
        theme.gradient,
        theme.glow
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/5 via-transparent to-transparent" />
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
      <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" />

      {/* Faint oversized logo watermark — only when a logo actually
          exists, so an unbranded tournament doesn't get a placeholder
          icon smeared across the hero. */}
      {tournament.logo && (
        <img
          src={tournament.logo}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 object-contain opacity-[0.07] blur-[1px] md:h-96 md:w-96"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}

      <div className="relative flex items-start gap-5">
        <TournamentCrest logo={tournament.logo} name={tournament.name || "Tournament"} />

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1",
                theme.badge
              )}
            >
              {isLive ? <LivePulse /> : <span className={cn("h-1.5 w-1.5 rounded-full", theme.dot)} />}
              {STATUS_META[tournament.status]?.label || tournament.status}
            </span>

            {isLive && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-300 ring-1 ring-rose-500/30">
                <Zap className="h-3 w-3" />
                Live Now
              </span>
            )}

            {isRegistrationOpen && !isDeadlinePassed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                <Activity className="h-3 w-3" />
                Registration Open
              </span>
            )}

            {isDeadlineSoon && !isDeadlinePassed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-500/30">
                <Clock className="h-3 w-3" />
                {daysToDeadline === 0 ? "Deadline today" : `${daysToDeadline}d left`}
              </span>
            )}

            {isDeadlinePassed && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-300 ring-1 ring-red-500/30">
                <Clock className="h-3 w-3" />
                Deadline Passed
              </span>
            )}
          </div>

          <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            {tournament.name || "Unnamed Tournament"}
          </h1>

          <p className={cn("mt-2 text-sm md:text-base", theme.text)}>
            {tournament.season ? `${tournament.season} · ` : ""}
            Organized by {tournament.organizerName || "Unknown"}
          </p>

          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {tournament.venue && (
              <span className={cn("flex items-center gap-1.5", theme.text)}>
                <MapPin className="h-4 w-4" />
                {tournament.venue}
              </span>
            )}
            {tournament.auctionDate && !isNaN(new Date(tournament.auctionDate).getTime()) && (
              <span className={cn("flex items-center gap-1.5", theme.text)}>
                <Gavel className="h-4 w-4" />
                Auction {format(new Date(tournament.auctionDate), "d MMM yyyy")}
              </span>
            )}
            {tournament.registrationDeadline && !isNaN(new Date(tournament.registrationDeadline).getTime()) && (
              <span className={cn("flex items-center gap-1.5", theme.text)}>
                <CalendarClock className="h-4 w-4" />
                Register by {format(new Date(tournament.registrationDeadline), "d MMM yyyy")}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═════════════════════════════════════════════════════════════════ */
export default function TournamentPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tournament, isLoading, isError, refetch, isRefetching } = useTournament(id);
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState("overview");

  // Auction ownership is decided here, once, and shared: TournamentPage
  // fetches the auction (and its rounds, when they're actually needed)
  // so any future consumer — a hero badge, a header pill — reads the
  // same cache instead of firing its own request.
  const isOwner = user?.role === "ORGANIZER" && user?.id === tournament?.organizerId;
  const eligibleForAuction = canShowAuctionModule(tournament?.status);

  const {
    auction,
    loading: auctionLoading,
    error: auctionError,
    refresh: refreshAuction,
  } = useAuction(eligibleForAuction ? tournament?.id : undefined);

  // Round counts only matter to the organizer's scheduled-state readout,
  // so they're only fetched for that audience rather than for everyone
  // who lands on the page.
  const { rounds: auctionRounds } = useAuctionRounds(
    eligibleForAuction && isOwner && auction ? auction.id : undefined
  );

  useEffect(() => {
    if (id) refetch();
  }, [id, refetch]);

  const theme = getTheme(tournament?.status);

  // These belong to Tournament, not Auction — they're what the Empty
  // state shows before any Auction document exists. Field names here
  // are a best guess (defaultPurse / squadSize / minBidIncrement /
  // lotTimerSeconds) since the Tournament type itself wasn't among
  // the files reviewed; adjust this mapping to match its real shape.
  const auctionDefaults: TournamentAuctionDefaults = {
    purse: (tournament as any)?.defaultPurse,
    squadSize: (tournament as any)?.squadSize,
    bidIncrement: (tournament as any)?.minBidIncrement,
    lotTimerSeconds: (tournament as any)?.lotTimerSeconds,
  };

  const teamsCount = typeof tournament?.teamsCount === "number" ? tournament.teamsCount : 0;
  const playersCount = typeof tournament?.playersCount === "number" ? tournament.playersCount : 0;
  const maxTeams = typeof tournament?.maxTeams === "number" ? tournament.maxTeams : 8;
  const squadSize = typeof tournament?.squadSize === "number" ? tournament.squadSize : 15;
  const defaultPurse = typeof tournament?.defaultPurse === "number" ? tournament.defaultPurse : 10_000_000;
  const currency = tournament?.currency ?? "INR";
  const teamFillPct = maxTeams > 0 ? Math.round((teamsCount / maxTeams) * 100) : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
          <Skeleton className="h-64 w-full rounded-3xl" />
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-28 rounded-2xl" />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-96 w-full rounded-2xl" />
            </div>
            <Skeleton className="h-96 w-full rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !tournament) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
          <Link
            to="/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50">
              <AlertTriangle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="mt-6 text-2xl font-bold text-slate-900">Tournament not found</h2>
            <p className="mt-2 max-w-sm text-sm text-slate-500">
              We couldn&apos;t locate the tournament you&apos;re looking for.
            </p>
            <Link
              to="/tournaments"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-colors hover:bg-slate-800"
            >
              Browse Tournaments
              <ChevronRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <Link
            to="/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </motion.div>

        <TournamentHero tournament={tournament} theme={theme} />

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard icon={Users} label="Teams" value={`${teamsCount}/${maxTeams}`} subtext={`${teamFillPct}% filled`} delay={0.1} />
          <StatCard icon={Trophy} label="Players" value={playersCount} subtext="Registered" delay={0.2} />
          <StatCard
            icon={DollarSign}
            label="Purse"
            value={new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(defaultPurse)}
            subtext={currency}
            delay={0.3}
          />
          <StatCard icon={Shield} label="Squad Size" value={squadSize} subtext="Players per team" delay={0.4} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500" />
              Team slots filled
            </span>
            <span>{teamsCount} of {maxTeams}</span>
          </div>
          <div className="mt-2">
            <ProgressBar current={teamsCount} max={maxTeams} color={teamFillPct >= 100 ? "bg-emerald-500" : "bg-sky-500"} />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {maxTeams - teamsCount > 0 ? `${maxTeams - teamsCount} slot${maxTeams - teamsCount !== 1 ? "s" : ""} remaining` : "All slots filled"}
          </p>
        </motion.div>

        <AuctionModule
          tournament={tournament}
          isOwner={isOwner}
          user={user}
          eligible={eligibleForAuction}
          auction={auction}
          loading={auctionLoading}
          error={auctionError}
          onRetry={refreshAuction}
          rounds={auctionRounds}
          teamsCount={teamsCount}
          playersCount={playersCount}
          defaults={auctionDefaults}
        />

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="lg:col-span-1"
          >
            <div className="space-y-4 lg:sticky lg:top-6">
              {isOwner && <OrganizerPanel tournament={tournament} isOwner={isOwner} />}
              {user?.role === "FRANCHISE_OWNER" && <FranchisePanel tournament={tournament} user={user} />}
              {user?.role === "PLAYER" && <PlayerPanel tournament={tournament} user={user} />}
              {user?.role === "ADMIN" && <AdminNotice />}
              {!user && <GuestNotice tournament={tournament} />}
              {user?.role === "ORGANIZER" && !isOwner && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
                  You&apos;re viewing a tournament organized by someone else. Only {tournament.organizerName} can edit it.
                </div>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="lg:col-span-2"
          >
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <Tabs
                value={tab}
                onChange={setTab}
                items={[
                  { value: "overview", label: "Overview" },
                  { value: "teams", label: "Franchises", count: teamsCount },
                  { value: "players", label: "Players", count: playersCount },
                ]}
              />
              <div className="p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {tab === "overview" && <OverviewTab tournament={tournament} />}
                    {tab === "teams" && <TeamsTab tournament={tournament} isOwner={isOwner} />}
                    {tab === "players" && <PlayersTab tournament={tournament} isOwner={isOwner} />}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}