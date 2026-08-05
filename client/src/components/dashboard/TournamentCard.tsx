import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  Gavel,
  MapPin,
  ShieldCheck,
  Trophy,
  Users,
  ArrowRight,
  Zap,
  Clock,
  CircleDot,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  UserPlus,
  Building2,
  CalendarDays,
  Flame,
  Crown,
  Ban,
  Eye,
  BarChart3,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";
import type { Tournament } from "@/types/tournament";
import type { User } from "@/types/user";
import { format } from "date-fns";

/* ═════════════════════════════════════════════════════════════════
   STATUS META — Defensive, exhaustive, and beautiful
   ═════════════════════════════════════════════════════════════════ */
interface StatusMeta {
  label: string;
  badge: string;
  dot: string;
  icon: React.ElementType;
  gradient: string;
  ring: string;
  description: string;
  glowColor: string;
  accentColor: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  DRAFT: {
    label: "Draft",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    icon: FileText,
    gradient: "from-slate-100 to-slate-200",
    ring: "ring-slate-200",
    description: "Not published yet",
    glowColor: "shadow-slate-500/5",
    accentColor: "bg-slate-500",
  },
  PLAYER_REGISTRATION_OPEN: {
    label: "Player Registration",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
    icon: UserPlus,
    gradient: "from-sky-50 to-blue-50",
    ring: "ring-sky-200",
    description: "Players can register",
    glowColor: "shadow-sky-500/5",
    accentColor: "bg-sky-500",
  },
  TEAM_REGISTRATION_OPEN: {
    label: "Team Registration",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
    icon: Building2,
    gradient: "from-indigo-50 to-violet-50",
    ring: "ring-indigo-200",
    description: "Franchises can join",
    glowColor: "shadow-indigo-500/5",
    accentColor: "bg-indigo-500",
  },
  TEAMS_APPROVED: {
    label: "Teams Approved",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    icon: CheckCircle2,
    gradient: "from-amber-50 to-orange-50",
    ring: "ring-amber-200",
    description: "Ready for auction",
    glowColor: "shadow-amber-500/5",
    accentColor: "bg-amber-500",
  },
  AUCTION_SCHEDULED: {
    label: "Auction Scheduled",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
    icon: CalendarDays,
    gradient: "from-violet-50 to-purple-50",
    ring: "ring-violet-200",
    description: "Auction date is set",
    glowColor: "shadow-violet-500/5",
    accentColor: "bg-violet-500",
  },
  AUCTION_RUNNING: {
    label: "Live Auction",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    icon: Flame,
    gradient: "from-rose-50 to-red-50",
    ring: "ring-rose-200",
    description: "Bidding in progress",
    glowColor: "shadow-rose-500/10",
    accentColor: "bg-rose-500",
  },
  AUCTION_COMPLETED: {
    label: "Auction Done",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    icon: Crown,
    gradient: "from-emerald-50 to-teal-50",
    ring: "ring-emerald-200",
    description: "Squads are finalized",
    glowColor: "shadow-emerald-500/5",
    accentColor: "bg-emerald-500",
  },
  TOURNAMENT_COMPLETED: {
    label: "Completed",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    icon: Trophy,
    gradient: "from-slate-100 to-slate-200",
    ring: "ring-slate-200",
    description: "Season wrapped up",
    glowColor: "shadow-slate-500/5",
    accentColor: "bg-slate-500",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    icon: Ban,
    gradient: "from-red-50 to-rose-50",
    ring: "ring-red-200",
    description: "Tournament cancelled",
    glowColor: "shadow-red-500/5",
    accentColor: "bg-red-500",
  },
};

const FALLBACK_STATUS: StatusMeta = {
  label: "Unknown",
  badge: "bg-slate-100 text-slate-500 border-slate-200",
  dot: "bg-slate-300",
  icon: CircleDot,
  gradient: "from-slate-100 to-slate-200",
  ring: "ring-slate-200",
  description: "Status unavailable",
  glowColor: "shadow-slate-500/5",
  accentColor: "bg-slate-400",
};

function getStatusMeta(status?: string): StatusMeta {
  if (!status) return FALLBACK_STATUS;
  return STATUS_META[status] ?? FALLBACK_STATUS;
}

/* ═════════════════════════════════════════════════════════════════
   MINI COMPONENTS
   ═════════════════════════════════════════════════════════════════ */
function ProgressBar({ current, max, color = "bg-emerald-500" }: { current: number; max: number; color?: string }) {
  const pct = Math.min((current / Math.max(max, 1)) * 100, 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-slate-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={`h-full rounded-full ${color}`}
      />
    </div>
  );
}

function LivePulse() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
    </span>
  );
}

function CountdownPill({ date }: { date?: string | Date | null }) {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;

  const days = differenceInDays(d, new Date());
  const isOver = isPast(d) && !isToday(d);
  const isTodayDate = isToday(d);

  if (isOver) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
        isTodayDate
          ? "bg-rose-50 text-rose-700 ring-rose-200"
          : days <= 3
          ? "bg-amber-50 text-amber-700 ring-amber-200"
          : "bg-emerald-50 text-emerald-700 ring-emerald-200"
      }`}
    >
      <Clock className="h-2.5 w-2.5" />
      {isTodayDate ? "Today" : days === 0 ? "Tomorrow" : `${days}d left`}
    </span>
  );
}

function isToday(d: Date) {
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function differenceInDays(a: Date, b: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((a.getTime() - b.getTime()) / msPerDay);
}

function isPast(d: Date) {
  return d.getTime() < new Date().getTime();
}

/**
 * Tournament crest — shows the logo when present, falls back to a
 * status-themed trophy badge (never a broken-image glyph or empty gap).
 */
function TournamentCrest({
  logo,
  name,
  gradient,
  ring,
  icon: Icon,
  size = "h-14 w-14",
}: {
  logo?: string | null;
  name: string;
  gradient: string;
  ring: string;
  icon: React.ElementType;
  size?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = !!logo && !failed;

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-sm ring-1 transition-all duration-300 group-hover:shadow-md ${size} ${
        showLogo ? "bg-white ring-slate-200" : `bg-gradient-to-br ${gradient} ${ring}`
      }`}
    >
      {showLogo ? (
        <img
          src={logo!}
          alt={`${name} logo`}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-2"
        />
      ) : (
        <Icon className="h-1/2 w-1/2 text-slate-500/70" />
      )}
    </div>
  );
}

/**
 * Background watermark logo — positioned off-center (top-right),
 * large, very low opacity for that modern editorial look.
 */
function BackgroundWatermark({
  logo,
  name,
  statusMeta,
}: {
  logo?: string | null;
  name: string;
  statusMeta: StatusMeta;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = !!logo && !failed;

  // If no logo, use a large status icon as watermark
  const WatermarkIcon = statusMeta.icon;

  return (
    <div className="pointer-events-none absolute -right-6 -top-6 h-48 w-48 opacity-[0.035] sm:h-56 sm:w-56 sm:opacity-[0.04]">
      {showLogo ? (
        <img
          src={logo!}
          alt=""
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <WatermarkIcon className="h-24 w-24 text-slate-900 sm:h-32 sm:w-32" strokeWidth={1} />
        </div>
      )}
    </div>
  );
}

/**
 * Subtle noise texture overlay for card depth
 */
function CardNoise() {
  return (
    <div
      className="pointer-events-none absolute inset-0 rounded-2xl opacity-[0.015]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}

/* ═════════════════════════════════════════════════════════════════
   TOURNAMENT CARD
   ═════════════════════════════════════════════════════════════════ */
export function TournamentCard({
  tournament,
  user,
  delay = 0,
  layoutMode = "grid",
}: {
  tournament: Tournament;
  user: User | null;
  delay?: number;
  layoutMode?: "grid" | "list";
}) {
  const meta = useMemo(() => getStatusMeta(tournament.status), [tournament.status]);
  const StatusIcon = meta.icon;

  const isOwner = user?.role === "ORGANIZER" && user.id === tournament.organizerId;
  const isAdmin = user?.role === "ADMIN";
  const isLive = tournament.status === "AUCTION_RUNNING";

  // Defensive number formatting
  const teamsCount = typeof tournament.teamsCount === "number" ? tournament.teamsCount : 0;
  const playersCount = typeof tournament.playersCount === "number" ? tournament.playersCount : 0;
  const maxTeams = typeof tournament.maxTeams === "number" ? tournament.maxTeams : 8;
  const defaultPurse = typeof tournament.defaultPurse === "number" ? tournament.defaultPurse : 10_000_000;
  const minBidIncrement = typeof tournament.minBidIncrement === "number" ? tournament.minBidIncrement : 50_000;
  const currency = tournament.currency ?? "INR";

  // Safe date formatting
  const auctionDate = tournament.auctionDate ? new Date(tournament.auctionDate) : null;
  const regDeadline = tournament.registrationDeadline ? new Date(tournament.registrationDeadline) : null;
  const createdAt = tournament.createdAt ? new Date(tournament.createdAt) : null;

  const isList = layoutMode === "list";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, type: "spring", stiffness: 100, damping: 15 }}
      whileHover={{ 
        y: -6, 
        transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } 
      }}
      className={`group relative flex overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-500 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-900/8 ${
        isLive ? "ring-1 ring-rose-200/60" : ""
      } ${isList ? "flex-row items-center gap-5 p-4 sm:p-5" : "flex-col"}`}
    >
      <CardNoise />
      <BackgroundWatermark logo={tournament.logo} name={tournament.name || "Tournament"} statusMeta={meta} />

      {/* Top accent bar */}
      <div className={`absolute left-0 top-0 h-full w-1 bg-gradient-to-b ${meta.gradient} ${isList ? "rounded-l-2xl" : "h-1.5 w-full rounded-t-2xl bg-gradient-to-r"}`} />

      {/* Live indicator stripe (vertical for list, horizontal for grid) */}
      {isLive && (
        <div className={`absolute bg-rose-500 ${isList ? "left-1 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-full" : "left-0 top-1.5 h-8 w-1 rounded-r-full"}`} />
      )}

      {/* Ambient glow on hover */}
      <div className={`pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${meta.glowColor} shadow-[0_0_40px_-10px]`} />

      {isList ? (
        /* ═══════ LIST LAYOUT ═══════ */
        <>
          {/* Crest */}
          <div className="relative shrink-0">
            <TournamentCrest
              logo={tournament.logo}
              name={tournament.name || "Tournament"}
              gradient={meta.gradient}
              ring={meta.ring}
              icon={Trophy}
              size="h-14 w-14 sm:h-16 sm:w-16"
            />
          </div>

          {/* Content */}
          <div className="relative flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
            {/* Title & Status */}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={`gap-1.5 border text-[10px] ${meta.badge}`}>
                  {isLive ? <LivePulse /> : <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />}
                  <StatusIcon className="h-3 w-3" />
                  {meta.label}
                </Badge>
                {isLive && (
                  <Badge className="gap-1 border-rose-200 bg-rose-50 text-rose-700 text-[10px]">
                    <Zap className="h-3 w-3" />
                    Live
                  </Badge>
                )}
                {(isOwner || isAdmin) && (
                  <Badge className="gap-1 border-slate-200 bg-slate-100 text-slate-500 text-[10px]">
                    <ShieldCheck className="h-3 w-3" />
                    {isOwner ? "Yours" : "Admin"}
                  </Badge>
                )}
              </div>

              <h3 className="mt-1.5 truncate text-base font-bold text-slate-900 transition-colors group-hover:text-emerald-700 sm:text-lg">
                {tournament.name || "Unnamed Tournament"}
              </h3>

              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                {tournament.season && (
                  <>
                    <CalendarClock className="h-3 w-3" />
                    {tournament.season}
                    <span className="text-slate-300">·</span>
                  </>
                )}
                <span className="truncate">by {tournament.organizerName || "Unknown organizer"}</span>
              </p>
            </div>

            {/* Middle: Details */}
            <div className="hidden shrink-0 flex-col gap-1 text-xs text-slate-500 md:flex">
              {tournament.venue && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  {tournament.venue}
                </span>
              )}
              {auctionDate && !isNaN(auctionDate.getTime()) && (
                <span className="flex items-center gap-1.5">
                  <Gavel className="h-3 w-3 text-slate-400" />
                  {format(auctionDate, "d MMM yyyy")}
                </span>
              )}
            </div>

            {/* Right: Stats + CTA */}
            <div className="flex shrink-0 items-center gap-4 sm:gap-6">
              <div className="hidden flex-col items-end gap-1 sm:flex">
                <span className="text-xs font-semibold text-slate-500">
                  {teamsCount}/{maxTeams} teams
                </span>
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                  <div 
                    className={`h-full rounded-full ${teamsCount >= maxTeams ? "bg-emerald-500" : "bg-sky-500"}`}
                    style={{ width: `${Math.min((teamsCount / Math.max(maxTeams, 1)) * 100, 100)}%` }}
                  />
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">
                  {formatCurrency(defaultPurse, currency)}
                </p>
                <p className="text-[10px] text-slate-400">Purse</p>
              </div>

              <Link to={`/tournaments/${tournament.id}`} className="shrink-0">
                <Button
                  variant={isOwner ? "primary" : "outline"}
                  size="sm"
                  className={`gap-1.5 text-xs transition-all ${
                    isOwner
                      ? "bg-slate-900 text-white hover:bg-slate-800"
                      : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {isOwner ? (
                    <>
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Manage</span>
                    </>
                  ) : isLive ? (
                    <>
                      <Zap className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Join</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden sm:inline">View</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </Button>
              </Link>
            </div>
          </div>
        </>
      ) : (
        /* ═══════ GRID LAYOUT ═══════ */
        <div className="relative flex flex-1 flex-col p-5">
          {/* Crest + Header row */}
          <div className="flex items-start gap-3">
            <TournamentCrest
              logo={tournament.logo}
              name={tournament.name || "Tournament"}
              gradient={meta.gradient}
              ring={meta.ring}
              icon={Trophy}
            />

            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`gap-1.5 border ${meta.badge}`}>
                    {isLive ? <LivePulse /> : <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />}
                    <StatusIcon className="h-3 w-3" />
                    {meta.label}
                  </Badge>
                  {isLive && (
                    <Badge className="gap-1 border-rose-200 bg-rose-50 text-rose-700 animate-pulse">
                      <Zap className="h-3 w-3" />
                      Live
                    </Badge>
                  )}
                </div>
                {(isOwner || isAdmin) && (
                  <Badge className="gap-1 border-slate-200 bg-slate-100 text-slate-500">
                    <ShieldCheck className="h-3 w-3" />
                    {isOwner ? "Yours" : "Admin"}
                  </Badge>
                )}
              </div>

              {/* Title */}
              <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-snug text-slate-900 transition-colors duration-300 group-hover:text-emerald-700">
                {tournament.name || "Unnamed Tournament"}
              </h3>

              {/* Season + Organizer */}
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                {tournament.season && (
                  <>
                    <CalendarClock className="h-3 w-3" />
                    {tournament.season}
                    <span className="text-slate-300">·</span>
                  </>
                )}
                <span className="truncate">by {tournament.organizerName || "Unknown organizer"}</span>
              </p>
            </div>
          </div>

          {/* Details grid */}
          <div className="mt-4 space-y-2.5">
            {tournament.venue && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100/80 ring-1 ring-slate-100">
                  <MapPin className="h-3 w-3 text-slate-500" />
                </span>
                <span className="truncate">{tournament.venue}</span>
              </div>
            )}

            {auctionDate && !isNaN(auctionDate.getTime()) && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100/80 ring-1 ring-slate-100">
                  <Gavel className="h-3 w-3 text-slate-500" />
                </span>
                <span>Auction {format(auctionDate, "d MMM yyyy")}</span>
                <CountdownPill date={tournament.auctionDate} />
              </div>
            )}

            {regDeadline && !isNaN(regDeadline.getTime()) && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-100/80 ring-1 ring-slate-100">
                  <CalendarClock className="h-3 w-3 text-slate-500" />
                </span>
                <span>Register by {format(regDeadline, "d MMM yyyy")}</span>
                <CountdownPill date={tournament.registrationDeadline} />
              </div>
            )}
          </div>

          {/* Teams progress */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-500" />
                Franchises
              </span>
              <span className="tabular-nums">
                {teamsCount}/{maxTeams}
              </span>
            </div>
            <div className="mt-1.5">
              <ProgressBar
                current={teamsCount}
                max={maxTeams}
                color={teamsCount >= maxTeams ? "bg-gradient-to-r from-emerald-400 to-emerald-500" : "bg-gradient-to-r from-sky-400 to-blue-500"}
              />
            </div>
          </div>

          {/* Players count */}
          <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              {playersCount} players registered
            </span>
          </div>

          {/* Purse info */}
          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3.5 py-2.5 text-xs text-slate-500 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <BarChart3 className="h-3 w-3 text-slate-400" />
                Purse
              </span>
              <span className="font-bold text-slate-700 tabular-nums">
                {formatCurrency(defaultPurse, currency)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span>Min bid</span>
              <span className="font-bold text-slate-700 tabular-nums">
                {formatCurrency(minBidIncrement, currency)}
              </span>
            </div>
          </div>

          {/* Footer: CTA */}
          <div className="mt-5 pt-2">
            <Link to={`/tournaments/${tournament.id}`} className="block">
              <Button
                variant={isOwner ? "primary" : "outline"}
                size="sm"
                className={`!w-full gap-2 transition-all duration-300 ${
                  isOwner
                    ? "bg-slate-900 text-white hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20"
                    : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
                }`}
              >
                {isOwner ? (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Manage tournament
                  </>
                ) : isLive ? (
                  <>
                    <Zap className="h-4 w-4" />
                    Join live auction
                  </>
                ) : (
                  <>
                    View details
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </Link>
          </div>

          {/* Created at (subtle) */}
          {createdAt && !isNaN(createdAt.getTime()) && (
            <p className="mt-3 text-center text-[10px] text-slate-300">
              Created {format(createdAt, "d MMM yyyy")}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}