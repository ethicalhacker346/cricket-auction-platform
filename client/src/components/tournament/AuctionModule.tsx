import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format, differenceInDays } from "date-fns";
import {
  Gavel,
  CalendarClock,
  ChevronRight,
  Trophy,
  AlertTriangle,
  RefreshCw,
  Layers,
  Wallet,
  Users,
  Timer as TimerIcon,
  TrendingUp,
  CheckCircle2,
  Circle,
  PauseCircle,
  Loader2,
  Settings2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { useLiveAuction } from "@/features/auction/hooks/index.hook";
import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { formatSeconds, formatLakhs } from "@/features/auction/utils/index.utils";
import type { Auction, AuctionRound, BidIncrementTier } from "@/features/auction/types/index.types";
import { cn } from "@/lib/utils";

/* ═════════════════════════════════════════════════════════════════
   TOURNAMENT-OWNED DEFAULTS
   ═════════════════════════════════════════════════════════════════ */
export interface TournamentAuctionDefaults {
  purse?: number; // lakhs
  squadSize?: number;
  bidIncrement?: number; // lakhs
  lotTimerSeconds?: number;
}

/* ═════════════════════════════════════════════════════════════════
   VIEWER ROLE
   ═════════════════════════════════════════════════════════════════ */
export type ViewerRole = "organizer" | "franchise" | "player" | "other";

export function getViewerRole(user: any, isOwner: boolean): ViewerRole {
  if (isOwner) return "organizer";
  if (user?.role === "FRANCHISE_OWNER") return "franchise";
  if (user?.role === "PLAYER") return "player";
  return "other";
}

/* ═════════════════════════════════════════════════════════════════
   GATE — exported so TournamentPage can decide whether it's even
   worth fetching the auction in the first place.
   ═════════════════════════════════════════════════════════════════ */
const STATUS_ORDER = [
  "DRAFT",
  "PLAYER_REGISTRATION_OPEN",
  "TEAM_REGISTRATION_OPEN",
  "TEAMS_APPROVED",
  "AUCTION_SCHEDULED",
  "AUCTION_RUNNING",
  "AUCTION_COMPLETED",
  "TOURNAMENT_COMPLETED",
];

export function canShowAuctionModule(status?: string): boolean {
  if (!status || status === "CANCELLED") return false;
  const idx = STATUS_ORDER.indexOf(status);
  const gate = STATUS_ORDER.indexOf("TEAMS_APPROVED");
  return idx >= gate;
}

/* ═════════════════════════════════════════════════════════════════
   ROUTING — useAuctionNavigate

   CRITICAL FIX: App.tsx defines auction routes under:
     /tournaments/:tournamentId/auction/:auctionId/*

   The legacy /auctions/* paths do NOT exist. Every navigation must
   include tournamentId and (when applicable) auctionId in the path.

   Route mapping:
     Create Auction (no auction yet):
       /tournaments/:tournamentId/auction/create

     Auction Dashboard (auction exists):
       /tournaments/:tournamentId/auction/:auctionId/dashboard

     Live Auction:
       /tournaments/:tournamentId/auction/:auctionId/live

     Results:
       /tournaments/:tournamentId/auction/:auctionId/results

     Configuration (rules editor):
       /tournaments/:tournamentId/auction/:auctionId/configuration
   ═════════════════════════════════════════════════════════════════ */
function useAuctionNavigate() {
  const navigate = useNavigate();
  const bootstrap = useLiveAuctionStore((s) => s.bootstrap);
  const setTournamentContext = useLiveAuctionStore((s) => s.setTournamentContext);

  return useCallback(
    (path: string, opts: { auctionId?: string; tournamentId: string; state?: Record<string, unknown> }) => {
      if (!opts.tournamentId) {
        console.error("[AuctionModule] Cannot navigate: tournamentId is undefined");
        return;
      }

      if (opts.auctionId) {
        bootstrap(opts.auctionId, opts.tournamentId);
      } else {
        setTournamentContext(opts.tournamentId);
      }

      const mergedState = {
        ...opts.state,
        tournamentId: opts.tournamentId,
        auctionId: opts.auctionId,
      };

      navigate(path, { state: mergedState });
    },
    [navigate, bootstrap, setTournamentContext]
  );
}

/** Button that guards against double-clicks while a navigation (and the
 *  bootstrap it triggers) is in flight. Auto re-enables after 4s as a
 *  safety net in case navigation is ever blocked. */
function NavButton({
  onGo,
  label,
  icon: Icon = ChevronRight,
  className,
  variant,
}: {
  onGo: () => void;
  label: string;
  icon?: React.ElementType;
  className?: string;
  variant?: "outline";
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant={variant}
      disabled={busy}
      className={cn("gap-1.5 whitespace-nowrap", className)}
      onClick={() => {
        if (busy) return;
        setBusy(true);
        onGo();
        setTimeout(() => setBusy(false), 4000);
      }}
    >
      {label}
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
    </Button>
  );
}

/* ═════════════════════════════════════════════════════════════════
   FORMATTING
   ═════════════════════════════════════════════════════════════════ */
function describeIncrement(tiers?: BidIncrementTier[]): string {
  if (!tiers?.length) return "—";
  const first = formatLakhs(tiers[0].increment);
  return tiers.length === 1 ? `${first} flat` : `${first}+ (tiered)`;
}

/* ═════════════════════════════════════════════════════════════════
   SHARED PIECES
   ═════════════════════════════════════════════════════════════════ */
function LivePulse() {
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
    </span>
  );
}

function ModuleIcon({
  icon: Icon,
  tone,
}: {
  icon: React.ElementType;
  tone: "amber" | "sky" | "teal" | "violet" | "rose-dark" | "amber-dark";
}) {
  const toneMap = {
    amber: "bg-amber-50 text-amber-500",
    sky: "bg-sky-100 text-sky-600",
    teal: "bg-teal-100 text-teal-600",
    violet: "bg-violet-100 text-violet-600",
    "rose-dark": "bg-white/10 text-rose-300",
    "amber-dark": "bg-white/10 text-amber-300",
  };
  return (
    <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", toneMap[tone])}>
      <Icon className="h-6 w-6" />
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="truncate text-sm font-bold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function ChecklistItem({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
      ) : (
        <Circle className="h-3.5 w-3.5 shrink-0 text-slate-300" />
      )}
      <span className={ok ? "text-slate-600" : "text-slate-400"}>{label}</span>
    </div>
  );
}

function MiniProgressBar({ value, max, tone = "light" }: { value: number; max: number; tone?: "light" | "dark" }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full", tone === "dark" ? "bg-white/10" : "bg-slate-100")}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={cn("h-full rounded-full", tone === "dark" ? "bg-rose-400" : "bg-teal-500")}
      />
    </div>
  );
}

function LiveStat({ label, value, sub, critical }: { label: string; value: string; sub?: string; critical?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-white/50">{label}</p>
      <p className={cn("mt-0.5 truncate text-base font-bold", critical ? "text-amber-300" : "text-white")}>{value}</p>
      {sub && <p className="truncate text-xs text-white/40">{sub}</p>}
    </div>
  );
}

const cardMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.3 },
};

/* ═════════════════════════════════════════════════════════════════
   LOADING
   ═════════════════════════════════════════════════════════════════ */
function AuctionModuleLoading() {
  return (
    <motion.div {...cardMotion} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-3 w-64 rounded" />
        </div>
        <Skeleton className="hidden h-9 w-36 rounded-lg sm:block" />
      </div>
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   ERROR — always retryable, never a dead end.
   ═════════════════════════════════════════════════════════════════ */
function AuctionModuleError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <motion.div
      {...cardMotion}
      className="flex flex-col items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
        <div>
          <p className="text-sm font-semibold text-red-700">Couldn&apos;t load the auction</p>
          <p className="text-xs text-red-500">{message}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 whitespace-nowrap">
        <RefreshCw className="h-3.5 w-3.5" />
        Retry
      </Button>
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   EMPTY — auction doesn't exist yet. Organizer sees a readiness
   checklist (why the button is enabled) plus exactly one CTA.
   Everyone else sees a waiting notice.
   ═════════════════════════════════════════════════════════════════ */
function AuctionModuleEmpty({
  tournamentId,
  role,
  teamsCount,
  playersCount,
  defaults,
}: {
  tournamentId: string;
  role: ViewerRole;
  teamsCount: number;
  playersCount: number;
  defaults: TournamentAuctionDefaults;
}) {
  const isOrganizer = role === "organizer";
  const goTo = useAuctionNavigate();
  const hasDefaults =
    defaults.purse != null || defaults.squadSize != null || defaults.bidIncrement != null || defaults.lotTimerSeconds != null;

  return (
    <motion.div {...cardMotion} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ModuleIcon icon={Gavel} tone="amber" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Auction</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {isOrganizer
                ? "Teams are approved. Create the auction to open the bidding floor."
                : "The organizer hasn't created the auction yet. Check back soon."}
            </p>
            {isOrganizer && (
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                <ChecklistItem ok={teamsCount > 0} label={`${teamsCount} team${teamsCount === 1 ? "" : "s"} approved`} />
                <ChecklistItem
                  ok={playersCount > 0}
                  label={`${playersCount} player${playersCount === 1 ? "" : "s"} registered`}
                />
              </div>
            )}

            {isOrganizer && hasDefaults && (
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-100 pt-4 sm:grid-cols-4">
                {defaults.purse != null && <MiniStat icon={Wallet} label="Default Purse" value={formatLakhs(defaults.purse)} />}
                {defaults.squadSize != null && <MiniStat icon={Users} label="Default Squad" value={defaults.squadSize} />}
                {defaults.bidIncrement != null && (
                  <MiniStat icon={TrendingUp} label="Default Increment" value={formatLakhs(defaults.bidIncrement)} />
                )}
                {defaults.lotTimerSeconds != null && (
                  <MiniStat icon={TimerIcon} label="Default Lot Timer" value={`${defaults.lotTimerSeconds}s`} />
                )}
              </div>
            )}
          </div>
        </div>
        {isOrganizer && (
          <div className="flex w-full flex-col items-end gap-1.5 sm:w-auto">
            <span className="text-[11px] font-medium uppercase tracking-wide text-amber-600/70">Next step</span>
            {/*
              Route: /tournaments/:tournamentId/auction/create
              This matches the standalone route in App.tsx that renders
              CreateAuctionPage outside of AuctionShell (no auction exists
              yet to shell around).
            */}
            <NavButton
              label="Create Auction"
              icon={Gavel}
              className="w-full sm:w-auto"
              onGo={() =>
                goTo(`/tournaments/${tournamentId}/auction/create`, {
                  tournamentId,
                  state: { tournamentId },
                })
              }
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   DRAFT — the auction document exists (rounds and rules can be
   configured), but it hasn't been scheduled yet. This is its own
   state, not a fallback-values version of Scheduled: "Auction
   Scheduled" would be a false claim while scheduledAt is still unset.
   ═════════════════════════════════════════════════════════════════ */
function AuctionModuleDraft({
  auction,
  tournamentId,
  role,
  rounds,
}: {
  auction: Auction;
  tournamentId: string;
  role: ViewerRole;
  rounds: AuctionRound[];
}) {
  const goTo = useAuctionNavigate();
  const isOrganizer = role === "organizer";

  return (
    <motion.div
      {...cardMotion}
      className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-white p-6 shadow-sm"
    >
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ModuleIcon icon={Settings2} tone="violet" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Auction Created</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {isOrganizer
                ? "Configure rounds and rules, then set a schedule to open the bidding floor."
                : "The organizer is setting up the auction. Check back once it's scheduled."}
            </p>
            {isOrganizer && (
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                <ChecklistItem ok={rounds.length > 0} label={`${rounds.length} round${rounds.length === 1 ? "" : "s"} configured`} />
                <ChecklistItem ok={!!auction.scheduledAt} label={auction.scheduledAt ? "Schedule set" : "Not yet scheduled"} />
              </div>
            )}
          </div>
        </div>
        {isOrganizer && (
          <NavButton
            label="Continue Setup"
            icon={Settings2}
            className="w-full sm:w-auto"
            onGo={() =>
              goTo(`/tournaments/${tournamentId}/auction/${auction.id}/dashboard`, {
                auctionId: auction.id,
                tournamentId,
              })
            }
          />
        )}
      </div>
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   SCHEDULED — auction exists, is past the draft/configuration step,
   and has a real scheduledAt. Only this state gets to say "Scheduled".
   ═════════════════════════════════════════════════════════════════ */
function AuctionModuleScheduled({
  auction,
  tournamentId,
  role,
  rounds,
  teamsCount,
  playersCount,
}: {
  auction: Auction;
  tournamentId: string;
  role: ViewerRole;
  rounds: AuctionRound[];
  teamsCount: number;
  playersCount: number;
}) {
  const goTo = useAuctionNavigate();
  const scheduledDate = auction.scheduledAt ? new Date(auction.scheduledAt) : null;
  const hasValidDate = !!scheduledDate && !isNaN(scheduledDate.getTime());
  const daysAway = hasValidDate ? differenceInDays(scheduledDate!, new Date()) : null;

  const roleMessage: Record<ViewerRole, string> = {
    organizer: "Review the format below, then open the dashboard to fine-tune and start.",
    franchise: "Please be available at the scheduled time — bidding opens automatically.",
    player: "Your profile has been approved. Sit tight until the auction begins.",
    other: "The auction is scheduled and will begin automatically.",
  };

  return (
    <motion.div
      {...cardMotion}
      className="relative overflow-hidden rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 via-white to-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <ModuleIcon icon={CalendarClock} tone="sky" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900">Auction Scheduled</h3>
              {auction.season && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                  {auction.season}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-600">
              {hasValidDate ? format(scheduledDate!, "EEEE, d MMM yyyy · h:mm a") : "Date to be announced"}
              {daysAway !== null && daysAway >= 0 && (
                <span className="text-slate-400"> · {daysAway === 0 ? "today" : `${daysAway}d away`}</span>
              )}
            </p>
            <p className="mt-1 text-xs text-slate-400">{roleMessage[role]}</p>

            {role === "organizer" && (
              <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
                <ChecklistItem ok={teamsCount > 0} label={`${teamsCount} team${teamsCount === 1 ? "" : "s"} approved`} />
                <ChecklistItem
                  ok={playersCount > 0}
                  label={`${playersCount} player${playersCount === 1 ? "" : "s"} registered`}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 border-t border-sky-100 pt-4 sm:items-end sm:border-t-0 sm:pt-0">
          {role === "organizer" && (
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:justify-end">
              <MiniStat icon={Layers} label="Rounds" value={rounds.length} />
              <MiniStat icon={Wallet} label="Purse" value={formatLakhs(auction.rules?.pursePerTeam ?? 0)} />
              <MiniStat icon={Users} label="Squad" value={auction.rules?.maxSquadSize ?? "—"} />
              <MiniStat icon={TimerIcon} label="Lot Timer" value={`${auction.rules?.lotTimerSeconds ?? "—"}s`} />
              <MiniStat icon={TrendingUp} label="Increment" value={describeIncrement(auction.rules?.bidIncrements)} />
            </div>
          )}
          {role === "organizer" && (
            <NavButton
              label="Open Dashboard"
              onGo={() =>
                goTo(`/tournaments/${tournamentId}/auction/${auction.id}/dashboard`, {
                  auctionId: auction.id,
                  tournamentId,
                })
              }
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   LIVE STATE CARD — shared shell for "live" and "paused". Subscribes
   to the real-time snapshot via useLiveAuction so the tournament page
   feels alive before anyone enters the live room.
   ═════════════════════════════════════════════════════════════════ */
function LiveSnapshotCard({
  auction,
  tournamentId,
  role,
  paused,
}: {
  auction: Auction;
  tournamentId: string;
  role: ViewerRole;
  paused: boolean;
}) {
  const goTo = useAuctionNavigate();
  // useLiveAuction takes ResolveAuctionIdsOptions object, not positional args.
  // We pass explicit IDs so it works even when this component is rendered
  // outside the AuctionShell route hierarchy (e.g. on TournamentPage).
  const live = useLiveAuction({ auctionId: auction.id, tournamentId });
  const isCurrentAuction = live.auctionId === auction.id;

  const totalPlayers = isCurrentAuction ? live.players.length : 0;
  const resolvedPlayers = isCurrentAuction ? live.playersSoldCount + live.playersUnsoldCount : 0;
  const timerCritical = isCurrentAuction && live.timer.remaining <= 5 && live.timer.remaining > 0;

  // Destination paths updated to match App.tsx nested routes.
  // Organizer goes to dashboard (control room), others go to live page.
  const destination = paused
    ? role === "organizer"
      ? `/tournaments/${tournamentId}/auction/${auction.id}/dashboard`
      : `/tournaments/${tournamentId}/auction/${auction.id}/live`
    : role === "organizer"
    ? `/tournaments/${tournamentId}/auction/${auction.id}/dashboard`
    : `/tournaments/${tournamentId}/auction/${auction.id}/live`;

  const ctaLabel = paused
    ? role === "organizer"
      ? "Resume from Dashboard"
      : "View Auction Room"
    : role === "organizer"
    ? "Enter Control Room"
    : role === "franchise"
    ? "Join Auction"
    : "Watch Live";

  const roleMessage: Record<ViewerRole, string> = {
    organizer: paused ? "You paused bidding. Resume when ready." : "Bidding is live. Manage lots from the control room.",
    franchise: paused ? "The organizer paused bidding. Hang tight." : "Bidding is live — jump in and place your bids.",
    player: paused ? "The organizer paused bidding. Hang tight." : "Bidding is live. Watch every lot as it happens.",
    other: paused ? "The organizer paused bidding. Hang tight." : "Bidding is live. Watch every lot as it happens.",
  };

  const theme = paused
    ? "border-amber-900/30 from-amber-950 via-slate-900 to-amber-950 shadow-amber-500/10"
    : "border-rose-900/30 from-rose-950 via-slate-900 to-rose-950 shadow-rose-500/10";
  const glow = paused ? "bg-amber-500/10" : "bg-rose-500/10";

  return (
    <motion.div
      {...cardMotion}
      className={cn("relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 text-white shadow-xl", theme)}
    >
      <div className={cn("pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl", glow)} />
      <div className="relative flex flex-col gap-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <ModuleIcon icon={paused ? PauseCircle : Gavel} tone={paused ? "amber-dark" : "rose-dark"} />
            <div>
              <div className="flex items-center gap-2">
                {paused ? <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> : <LivePulse />}
                <h3 className="text-sm font-semibold">{paused ? "Auction Paused" : "Auction Live"}</h3>
              </div>
              <p className="mt-0.5 text-sm text-white/70">{roleMessage[role]}</p>
            </div>
          </div>
          <NavButton
            label={ctaLabel}
            className={cn(
              "w-full sm:w-auto",
              paused ? "bg-white text-slate-900 hover:bg-amber-50" : "bg-white text-slate-900 hover:bg-rose-50"
            )}
            onGo={() =>
              goTo(destination, {
                auctionId: auction.id,
                tournamentId,
              })
            }
          />
        </div>

        {isCurrentAuction && live.currentPlayer ? (
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4 sm:grid-cols-4">
            <LiveStat label="Current Player" value={live.currentPlayer.name} sub={live.currentPlayer.role} />
            <LiveStat
              label="Current Bid"
              value={formatLakhs(live.currentBid.amount)}
              sub={live.leadingFranchise?.shortName}
            />
            <LiveStat
              label="Timer"
              value={formatSeconds(live.timer.remaining)}
              critical={timerCritical}
            />
            <LiveStat label="Round" value={live.currentRound?.name ?? "—"} />
          </div>
        ) : (
          <p className="border-t border-white/10 pt-4 text-xs text-white/40">
            {isCurrentAuction ? "Waiting for the next lot to open…" : "Connecting to the auction feed…"}
          </p>
        )}

        {isCurrentAuction && totalPlayers > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-white/50">
              <span>Players resolved</span>
              <span>
                {resolvedPlayers}/{totalPlayers}
              </span>
            </div>
            <MiniProgressBar value={resolvedPlayers} max={totalPlayers} tone="dark" />
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   COMPLETED — no role differences left; everyone gets the same
   destination. Shows a final tally if the store still has it cached
   from the live session; never fabricates numbers it doesn't have.
   ═════════════════════════════════════════════════════════════════ */
function AuctionModuleCompleted({ auction, tournamentId }: { auction: Auction; tournamentId: string }) {
  const goTo = useAuctionNavigate();
  const storeAuctionId = useLiveAuctionStore((s) => s.auctionId);
  const soldCount = useLiveAuctionStore((s) => s.playersSoldCount);
  const unsoldCount = useLiveAuctionStore((s) => s.playersUnsoldCount);
  const totalPlayers = useLiveAuctionStore((s) => s.players.length);
  const hasCachedTally = storeAuctionId === auction.id && totalPlayers > 0;

  return (
    <motion.div
      {...cardMotion}
      className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 via-white to-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <ModuleIcon icon={Trophy} tone="teal" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Auction Completed</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              {auction.season ? `The ${auction.season} auction` : "The auction"} has wrapped up. Squads are finalized.
            </p>
            {hasCachedTally && (
              <p className="mt-1 text-xs text-slate-400">
                {soldCount} sold · {unsoldCount} unsold · {totalPlayers} total
              </p>
            )}
          </div>
        </div>
        <NavButton
          label="View Results"
          variant="outline"
          className="w-full sm:w-auto"
          onGo={() =>
            goTo(`/tournaments/${tournamentId}/auction/${auction.id}/results`, {
              auctionId: auction.id,
              tournamentId,
            })
          }
        />
      </div>
    </motion.div>
  );
}

/* ═════════════════════════════════════════════════════════════════
   AUCTION MODULE — the single entry point.
   ═════════════════════════════════════════════════════════════════ */
export function AuctionModule({
  tournament,
  isOwner,
  user,
  eligible,
  auction,
  loading,
  error,
  onRetry,
  rounds,
  teamsCount,
  playersCount,
  defaults,
}: {
  tournament: { id: string; status?: string; name?: string; organizerName?: string; organizerId?: string };
  isOwner: boolean;
  user: any;
  eligible: boolean;
  auction: Auction | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  rounds: AuctionRound[];
  teamsCount: number;
  playersCount: number;
  defaults: TournamentAuctionDefaults;
}) {
  const role = getViewerRole(user, isOwner);

  if (!eligible) return null;

  let state: "loading" | "error" | "empty" | "draft" | "completed" | "live" | "paused" | "scheduled";
  if (loading) state = "loading";
  else if (error) state = "error";
  else if (!auction) state = "empty";
  else if (auction.status === "completed") state = "completed";
  else if (auction.status === "paused") state = "paused";
  else if (auction.status === "live") state = "live";
  else if (auction.status === "draft" && auction.scheduledAt) state = "scheduled";
  else state = "draft";

  return (
    <section className="mt-6" aria-label="Auction status">
      <AnimatePresence mode="wait">
        {state === "loading" && <AuctionModuleLoading key="loading" />}
        {state === "error" && <AuctionModuleError key="error" message={error!} onRetry={onRetry} />}
        {state === "empty" && (
          <AuctionModuleEmpty
            key="empty"
            tournamentId={tournament.id}
            role={role}
            teamsCount={teamsCount}
            playersCount={playersCount}
            defaults={defaults}
          />
        )}
        {state === "draft" && auction && (
          <AuctionModuleDraft
            key="draft"
            auction={auction}
            tournamentId={tournament.id}
            role={role}
            rounds={rounds}
          />
        )}
        {state === "scheduled" && auction && (
          <AuctionModuleScheduled
            key="scheduled"
            auction={auction}
            tournamentId={tournament.id}
            role={role}
            rounds={rounds}
            teamsCount={teamsCount}
            playersCount={playersCount}
          />
        )}
        {(state === "live" || state === "paused") && auction && (
          <LiveSnapshotCard
            key={state}
            auction={auction}
            tournamentId={tournament.id}
            role={role}
            paused={state === "paused"}
          />
        )}
        {state === "completed" && auction && (
          <AuctionModuleCompleted key="completed" auction={auction} tournamentId={tournament.id} />
        )}
      </AnimatePresence>
    </section>
  );
}