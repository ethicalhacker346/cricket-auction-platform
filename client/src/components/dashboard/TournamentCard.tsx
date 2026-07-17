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
} from "lucide-react";
import { format, isPast, isFuture, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";
import type { Tournament } from "@/types/tournament";
import type { User } from "@/types/user";

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
  },
  PLAYER_REGISTRATION_OPEN: {
    label: "Player Registration",
    badge: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
    icon: UserPlus,
    gradient: "from-sky-50 to-blue-50",
    ring: "ring-sky-200",
    description: "Players can register",
  },
  TEAM_REGISTRATION_OPEN: {
    label: "Team Registration",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
    icon: Building2,
    gradient: "from-indigo-50 to-violet-50",
    ring: "ring-indigo-200",
    description: "Franchises can join",
  },
  TEAMS_APPROVED: {
    label: "Teams Approved",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    icon: CheckCircle2,
    gradient: "from-amber-50 to-orange-50",
    ring: "ring-amber-200",
    description: "Ready for auction",
  },
  AUCTION_SCHEDULED: {
    label: "Auction Scheduled",
    badge: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
    icon: CalendarDays,
    gradient: "from-violet-50 to-purple-50",
    ring: "ring-violet-200",
    description: "Auction date is set",
  },
  AUCTION_RUNNING: {
    label: "Live Auction",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
    icon: Flame,
    gradient: "from-rose-50 to-red-50",
    ring: "ring-rose-200",
    description: "Bidding in progress",
  },
  AUCTION_COMPLETED: {
    label: "Auction Done",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    icon: Crown,
    gradient: "from-emerald-50 to-teal-50",
    ring: "ring-emerald-200",
    description: "Squads are finalized",
  },
  TOURNAMENT_COMPLETED: {
    label: "Completed",
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    icon: Trophy,
    gradient: "from-slate-100 to-slate-200",
    ring: "ring-slate-200",
    description: "Season wrapped up",
  },
  CANCELLED: {
    label: "Cancelled",
    badge: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    icon: Ban,
    gradient: "from-red-50 to-rose-50",
    ring: "ring-red-200",
    description: "Tournament cancelled",
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
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
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

  function isToday(d: Date) {
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  }

  if (isOver) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
        isTodayDate
          ? "bg-rose-100 text-rose-700"
          : days <= 3
          ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
    >
      <Clock className="h-2.5 w-2.5" />
      {isTodayDate ? "Today" : days === 0 ? "Tomorrow" : `${days}d left`}
    </span>
  );
}

/**
 * Tournament crest — shows the logo when present, falls back to a
 * status-themed trophy badge (never a broken-image glyph or empty gap).
 * The gradient/ring match the card's own status theme, so an unbranded
 * tournament still looks intentional rather than incomplete.
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
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-sm ring-1 ${size} ${
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
        <Icon className="h-1/2 w-1/2 text-slate-500" />
      )}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   TOURNAMENT CARD
   ═════════════════════════════════════════════════════════════════ */
export function TournamentCard({
  tournament,
  user,
  delay = 0,
}: {
  tournament: Tournament;
  user: User | null;
  delay?: number;
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay, type: "spring", stiffness: 100, damping: 15 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow-lg hover:shadow-slate-900/5 ${
        isLive ? "ring-1 ring-rose-200/60" : ""
      }`}
    >
      {/* Top accent bar */}
      <div className={`h-1.5 w-full bg-gradient-to-r ${meta.gradient}`} />

      {/* Live indicator stripe */}
      {isLive && (
        <div className="absolute left-0 top-1.5 h-8 w-1 rounded-r-full bg-rose-500" />
      )}

      <div className="flex flex-1 flex-col p-5">
        {/* Crest + Header row: Status + Owner badge */}
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
                  <Badge className="gap-1 border-rose-200 bg-rose-50 text-rose-700">
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
            <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-snug text-slate-900 transition-colors group-hover:text-emerald-700">
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
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100">
                <MapPin className="h-3 w-3 text-slate-500" />
              </span>
              <span className="truncate">{tournament.venue}</span>
            </div>
          )}

          {auctionDate && !isNaN(auctionDate.getTime()) && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100">
                <Gavel className="h-3 w-3 text-slate-500" />
              </span>
              <span>Auction {format(auctionDate, "d MMM yyyy")}</span>
              <CountdownPill date={tournament.auctionDate} />
            </div>
          )}

          {regDeadline && !isNaN(regDeadline.getTime()) && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100">
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
            <span>
              {teamsCount}/{maxTeams}
            </span>
          </div>
          <div className="mt-1.5">
            <ProgressBar
              current={teamsCount}
              max={maxTeams}
              color={teamsCount >= maxTeams ? "bg-emerald-500" : "bg-sky-500"}
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
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <div className="flex items-center justify-between">
            <span>Purse</span>
            <span className="font-semibold text-slate-700">
              {formatCurrency(defaultPurse, currency)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between">
            <span>Min bid</span>
            <span className="font-semibold text-slate-700">
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
              className={`!w-full gap-2 transition-all ${
                isOwner
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
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
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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
    </motion.div>
  );
}