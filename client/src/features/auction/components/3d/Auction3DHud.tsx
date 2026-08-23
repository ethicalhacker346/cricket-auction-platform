import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Boxes,
  ChevronLeft,
  CircleDollarSign,
  Eye,
  EyeOff,
  Focus,
  Gauge,
  Gamepad2,
  Gavel,
  ListOrdered,
  Maximize2,
  Minimize2,
  Orbit,
  Radio,
  Settings2,
  Shield,
  Trophy,
  Users,
  Wifi,
  X,
} from "lucide-react";
import type {
  AuctionLog,
  AuctionRound,
  AuctionStatus,
  Bid,
  Franchise,
  Player,
} from "@/features/auction/types/index.types";
import { AuctionRoutes } from "@/features/auction/routes/auction.routes";
import { AuctionControls } from "@/features/auction/components/AuctionControls";
import { formatLakhs, formatSeconds, initials, timeAgo } from "@/features/auction/utils/index.utils";
import type {
  Auction3DCameraMode,
  Auction3DQuality,
} from "@/features/auction/hooks/useAuction3DPreferences";

export type Auction3DDrawer = "activity" | "teams" | "queue" | "controls" | null;

interface HudPermissionShape {
  loading: boolean;
  canBid: boolean;
  canManageAuction: boolean;
}

interface Auction3DHudProps {
  tournamentId: string;
  auctionId: string;
  player: Player | null;
  players: Player[];
  franchises: Franchise[];
  leadingFranchise: Franchise | null;
  userTeam: Franchise | null;
  currentBid: { amount: number; teamId: string | null };
  timer: { remaining: number; total: number; isRunning: boolean };
  status: AuctionStatus;
  connection: "connecting" | "connected" | "reconnecting" | "offline";
  latencyMs: number;
  viewerCount: number;
  currentRound: AuctionRound | null;
  rounds: AuctionRound[];
  upcomingPlayers: Player[];
  bidHistory: Bid[];
  logs: AuctionLog[];
  soldCount: number;
  unsoldCount: number;
  totalMoneySpent: number;
  permissions: HudPermissionShape;
  quality: Auction3DQuality;
  onQualityChange: (quality: Auction3DQuality) => void;
  cameraMode: Auction3DCameraMode;
  onCameraModeChange: (mode: Auction3DCameraMode) => void;
  fullscreenTarget: RefObject<HTMLDivElement | null>;
}

const QUALITY_ORDER: Auction3DQuality[] = ["performance", "balanced", "cinematic"];

function statusClasses(status: AuctionStatus) {
  switch (status) {
    case "live":
      return "border-emerald-300/25 bg-emerald-300/10 text-emerald-200";
    case "paused":
      return "border-amber-300/25 bg-amber-300/10 text-amber-200";
    case "completed":
      return "border-violet-300/25 bg-violet-300/10 text-violet-200";
    default:
      return "border-sky-300/20 bg-sky-300/10 text-sky-200";
  }
}

function TinyAvatar({ player, className = "h-9 w-9" }: { player: Player; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [player.profileImage]);

  if (player.profileImage && !failed) {
    return (
      <img
        src={player.profileImage}
        alt=""
        onError={() => setFailed(true)}
        className={`${className} shrink-0 rounded-xl object-cover ring-1 ring-white/10`}
      />
    );
  }

  return (
    <span className={`${className} flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 text-[10px] font-black text-white ring-1 ring-white/10`}>
      {initials(player.name)}
    </span>
  );
}

function TeamLogo({ team, className = "h-8 w-8" }: { team: Franchise; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [team.logo]);

  if (team.logo && !failed) {
    return (
      <img
        src={team.logo}
        alt=""
        onError={() => setFailed(true)}
        className={`${className} shrink-0 rounded-xl bg-white/5 object-contain ring-1 ring-white/10`}
      />
    );
  }

  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-xl text-[9px] font-black text-white ring-1 ring-white/10`}
      style={{ background: `linear-gradient(135deg, ${team.colorFrom}, ${team.colorTo})` }}
    >
      {initials(team.shortName)}
    </span>
  );
}

function TimerDial({ timer }: { timer: Auction3DHudProps["timer"] }) {
  const size = 88;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const progress = timer.total > 0 ? Math.max(0, Math.min(1, timer.remaining / timer.total)) : 0;
  const critical = timer.remaining > 0 && timer.remaining <= 5;

  return (
    <div className="relative h-[88px] w-[88px] shrink-0">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx="44" cy="44" r={radius} fill="rgba(3,7,18,.76)" stroke="rgba(255,255,255,.08)" strokeWidth="6" />
        <motion.circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          stroke={critical ? "#fb7185" : "#fcd34d"}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animate={{ strokeDashoffset: circumference * (1 - progress) }}
          transition={{ duration: 0.3, ease: "linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-mono text-[18px] font-black tabular-nums ${critical ? "animate-pulse text-rose-300" : "text-white"}`}>
          {formatSeconds(timer.remaining)}
        </span>
        <span className="mt-0.5 text-[7px] font-black uppercase tracking-[0.22em] text-slate-500">
          {timer.isRunning ? "On clock" : timer.remaining ? "Paused" : "Closed"}
        </span>
      </div>
    </div>
  );
}

function PlayerHudCard({
  player,
  currentBid,
  leadingFranchise,
  timer,
}: {
  player: Player | null;
  currentBid: Auction3DHudProps["currentBid"];
  leadingFranchise: Franchise | null;
  timer: Auction3DHudProps["timer"];
}) {
  return (
    <motion.aside
      key={player?.id ?? "empty"}
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      className="pointer-events-auto w-[292px] overflow-hidden rounded-[22px] border border-white/10 bg-[#050813]/82 p-3.5 shadow-[0_22px_70px_rgba(0,0,0,.4)] backdrop-blur-2xl"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.28em] text-cyan-300/65">
          <Radio className="h-3 w-3" /> Center stage
        </span>
        {player?.tag ? (
          <span className="rounded-full bg-amber-300/12 px-2 py-1 text-[8px] font-black uppercase text-amber-200 ring-1 ring-amber-300/20">
            {player.tag}
          </span>
        ) : null}
      </div>

      {player ? (
        <>
          <div className="mt-3 flex items-center gap-3">
            <TinyAvatar player={player} className="h-14 w-14" />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-black tracking-[-0.04em] text-white">{player.name}</h1>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                {player.role} {player.country ? <span className="text-slate-600">· {player.country}</span> : null}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-lg bg-white/5 px-2 py-1 text-[9px] font-bold text-slate-300 ring-1 ring-white/8">
                  Base {formatLakhs(player.basePrice)}
                </span>
                {player.age ? (
                  <span className="rounded-lg bg-white/5 px-2 py-1 text-[9px] font-bold text-slate-400 ring-1 ring-white/8">
                    {player.age} yrs
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3.5 flex items-center gap-3 border-t border-white/8 pt-3.5">
            <TimerDial timer={timer} />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-300/65">Highest bid</p>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={currentBid.amount}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="mt-1 truncate text-2xl font-black tracking-[-0.06em] text-white"
                >
                  {currentBid.amount > 0 ? formatLakhs(currentBid.amount) : "No bids"}
                </motion.p>
              </AnimatePresence>
              {leadingFranchise ? (
                <div className="mt-2 flex min-w-0 items-center gap-2">
                  <TeamLogo team={leadingFranchise} className="h-7 w-7" />
                  <span className="truncate text-[11px] font-bold text-slate-300">{leadingFranchise.shortName} leads</span>
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-slate-500">Opening bid available</p>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex min-h-[145px] flex-col items-center justify-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-300/8 text-cyan-300 ring-1 ring-cyan-300/15">
            <Gavel className="h-5 w-5" />
          </span>
          <p className="mt-4 text-sm font-black text-white">Stage is ready</p>
          <p className="mt-1 text-xs text-slate-500">The next player will materialize here.</p>
        </div>
      )}
    </motion.aside>
  );
}

function LivePulsePanel({
  bids,
  franchises,
  players,
  viewerCount,
}: {
  bids: Bid[];
  franchises: Franchise[];
  players: Player[];
  viewerCount: number;
}) {
  return (
    <aside className="pointer-events-auto w-[252px] rounded-[22px] border border-white/10 bg-[#050813]/82 p-3 shadow-[0_22px_70px_rgba(0,0,0,.36)] backdrop-blur-2xl">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">
          <Activity className="h-3.5 w-3.5 text-cyan-300" /> Bid pulse
        </span>
        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
          <Eye className="h-3 w-3" /> {viewerCount}
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        <AnimatePresence initial={false} mode="popLayout">
          {bids.slice(0, 5).map((bid, index) => {
            const team = franchises.find((candidate) => candidate.id === bid.teamId);
            const player = players.find((candidate) => candidate.id === bid.playerId);
            return (
              <motion.div
                layout
                key={bid.id}
                initial={{ opacity: 0, x: 14, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8 }}
                className={`flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
                  index === 0 ? "border-amber-300/20 bg-amber-300/[0.06]" : "border-white/5 bg-white/[0.025]"
                }`}
              >
                {team ? <TeamLogo team={team} className="h-6 w-6" /> : <Shield className="h-6 w-6 text-slate-600" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[10px] font-black text-slate-200">{team?.shortName ?? "Team"}</p>
                  <p className="truncate text-[8px] text-slate-500">{player?.name ?? "Current lot"}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-black text-amber-200">{formatLakhs(bid.amount)}</p>
                  <p className="text-[8px] text-slate-600">{timeAgo(bid.timestamp)}</p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {bids.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-600">The first bid will appear here.</p>
        ) : null}
      </div>
    </aside>
  );
}

function TeamsDrawer({ franchises, currentBid }: { franchises: Franchise[]; currentBid: Auction3DHudProps["currentBid"] }) {
  return (
    <div className="space-y-2">
      {[...franchises]
        .sort((a, b) => b.purseTotal - b.spent - (a.purseTotal - a.spent))
        .map((team) => {
          const remaining = Math.max(0, team.purseTotal - team.spent - (team.reservedBudget ?? 0));
          const percentage = team.purseTotal > 0 ? (remaining / team.purseTotal) * 100 : 0;
          const leading = team.id === currentBid.teamId;
          return (
            <div
              key={team.id}
              className={`rounded-2xl border p-3 ${leading ? "border-amber-300/25 bg-amber-300/[0.06]" : "border-white/7 bg-white/[0.025]"}`}
            >
              <div className="flex items-center gap-3">
                <TeamLogo team={team} className="h-10 w-10" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-black text-white">{team.name}</p>
                    {leading ? <span className="text-[8px] font-black uppercase text-amber-200">Leading</span> : null}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[9px] text-slate-500">
                    <span>{team.squad.length}/{team.maxSquadSize} players</span>
                    <span className="font-bold text-slate-300">{formatLakhs(remaining)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(0, Math.min(100, percentage))}%`,
                    background: `linear-gradient(90deg, ${team.colorFrom}, ${team.colorTo})`,
                  }}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}

function QueueDrawer({
  upcomingPlayers,
  rounds,
  players,
}: {
  upcomingPlayers: Player[];
  rounds: AuctionRound[];
  players: Player[];
}) {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Up next</h3>
        <div className="space-y-2">
          {upcomingPlayers.map((player, index) => (
            <div key={player.id} className="flex items-center gap-3 rounded-2xl border border-white/7 bg-white/[0.025] p-2.5">
              <span className="w-5 text-center text-[9px] font-black text-slate-600">{String(index + 1).padStart(2, "0")}</span>
              <TinyAvatar player={player} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-white">{player.name}</p>
                <p className="mt-0.5 text-[9px] text-slate-500">{player.role} · {formatLakhs(player.basePrice)}</p>
              </div>
            </div>
          ))}
          {upcomingPlayers.length === 0 ? <p className="py-5 text-center text-xs text-slate-600">No players queued.</p> : null}
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Round map</h3>
        <div className="space-y-2">
          {[...rounds].sort((a, b) => a.order - b.order).map((round) => {
            const roundPlayers = players.filter((player) => round.playerIds.includes(player.id));
            const settled = roundPlayers.filter((player) => player.status === "sold" || player.status === "permanent_unsold").length;
            const progress = roundPlayers.length > 0 ? (settled / roundPlayers.length) * 100 : 0;
            return (
              <div key={round.id} className="rounded-2xl border border-white/7 bg-white/[0.025] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-xs font-bold text-slate-200">{round.name}</p>
                  <span className="text-[8px] font-black uppercase text-slate-500">{round.status}</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/8">
                  <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-1.5 text-[9px] text-slate-600">{settled}/{roundPlayers.length} settled</p>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function ActivityDrawer({
  bids,
  logs,
  franchises,
  players,
}: {
  bids: Bid[];
  logs: AuctionLog[];
  franchises: Franchise[];
  players: Player[];
}) {
  return (
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Bid stream</h3>
        <div className="space-y-2">
          {bids.slice(0, 12).map((bid) => {
            const team = franchises.find((candidate) => candidate.id === bid.teamId);
            const player = players.find((candidate) => candidate.id === bid.playerId);
            return (
              <div key={bid.id} className="flex items-center gap-3 rounded-2xl border border-white/7 bg-white/[0.025] p-2.5">
                {team ? <TeamLogo team={team} /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-slate-200">{team?.name ?? "Unknown team"}</p>
                  <p className="truncate text-[9px] text-slate-500">{player?.name ?? "Player"} · {timeAgo(bid.timestamp)}</p>
                </div>
                <span className="text-xs font-black text-amber-200">{formatLakhs(bid.amount)}</span>
              </div>
            );
          })}
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Auction timeline</h3>
        <div className="relative space-y-3 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-white/8">
          {logs.slice(0, 18).map((log) => (
            <div key={log.id} className="relative flex gap-3 pl-0.5">
              <span className="relative z-10 mt-1 h-2 w-2 shrink-0 rounded-full bg-cyan-300 ring-4 ring-[#070a13]" />
              <div>
                <p className="text-[11px] leading-4 text-slate-300">{log.message}</p>
                <p className="mt-0.5 text-[8px] text-slate-600">{timeAgo(log.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Drawer({
  active,
  onClose,
  onChange,
  props,
}: {
  active: Exclude<Auction3DDrawer, null>;
  onClose: () => void;
  onChange: (drawer: Exclude<Auction3DDrawer, null>) => void;
  props: Auction3DHudProps;
}) {
  const titles: Record<Exclude<Auction3DDrawer, null>, string> = {
    activity: "Live activity",
    teams: "Franchise floor",
    queue: "Auction runway",
    controls: "Organizer console",
  };

  return (
    <motion.aside
      initial={{ opacity: 0, x: 32, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 32, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 320, damping: 30 }}
      className="pointer-events-auto absolute bottom-[176px] right-3 top-[74px] z-30 flex w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-[26px] border border-white/12 bg-[#050813]/96 shadow-[0_32px_120px_rgba(0,0,0,.72)] backdrop-blur-3xl 2xl:bottom-[76px]"
    >
      <header className="flex items-center justify-between border-b border-white/8 px-4 py-3.5">
        <div>
          <p className="text-[8px] font-black uppercase tracking-[0.3em] text-cyan-300/55">Immersive intelligence</p>
          <h2 className="mt-0.5 text-sm font-black text-white">{titles[active]}</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close panel" className="rounded-xl p-2 text-slate-400 transition hover:bg-white/8 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </header>

      {active !== "controls" ? (
        <div className="grid grid-cols-3 gap-2 border-b border-white/8 p-2">
          {(["activity", "teams", "queue"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onChange(tab)}
              className={`rounded-xl px-2 py-2 text-[9px] font-black uppercase tracking-wider ${active === tab ? "bg-white/10 text-white" : "text-slate-500"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-3 [scrollbar-color:rgba(148,163,184,.25)_transparent] [scrollbar-width:thin]">
        {active === "activity" ? (
          <ActivityDrawer bids={props.bidHistory} logs={props.logs} franchises={props.franchises} players={props.players} />
        ) : null}
        {active === "teams" ? <TeamsDrawer franchises={props.franchises} currentBid={props.currentBid} /> : null}
        {active === "queue" ? <QueueDrawer upcomingPlayers={props.upcomingPlayers} rounds={props.rounds} players={props.players} /> : null}
        {active === "controls" ? <AuctionControls /> : null}
      </div>
    </motion.aside>
  );
}

function IconAction({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[9px] font-black uppercase tracking-wider transition ${
        active ? "bg-cyan-300/12 text-cyan-200 ring-1 ring-cyan-300/20" : "bg-white/[0.045] text-slate-400 ring-1 ring-white/8 hover:bg-white/10 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

export function Auction3DHud(props: Auction3DHudProps) {
  const [drawer, setDrawer] = useState<Auction3DDrawer>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [cleanView, setCleanView] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "h" || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button, [contenteditable='true']")) return;
      setDrawer(null);
      setCleanView((current) => !current);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await props.fullscreenTarget.current?.requestFullscreen();
    } catch {
      // Browser policy may deny fullscreen; the room remains fully usable.
    }
  };

  const cycleQuality = () => {
    const current = QUALITY_ORDER.indexOf(props.quality);
    props.onQualityChange(QUALITY_ORDER[(current + 1) % QUALITY_ORDER.length]);
  };

  const toggleDrawer = (next: Exclude<Auction3DDrawer, null>) => {
    setDrawer((current) => (current === next ? null : next));
  };

  const completion = props.players.length > 0
    ? Math.min(100, ((props.soldCount + props.unsoldCount) / props.players.length) * 100)
    : 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden text-white">
      <header className="pointer-events-auto absolute inset-x-3 top-3 z-40 flex h-[50px] items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#050813]/72 px-2.5 shadow-xl backdrop-blur-2xl sm:px-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            to={AuctionRoutes.live(props.tournamentId, props.auctionId)}
            aria-label="Return to standard live auction"
            title="Standard live room"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white/[0.055] text-slate-400 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="hidden h-7 w-px bg-white/10 sm:block" />
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br from-cyan-400/20 to-violet-500/20 text-cyan-200 ring-1 ring-cyan-300/20">
              <Boxes className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-black tracking-[-0.02em] sm:text-sm">GullyBid Arena</p>
              <p className="hidden text-[8px] font-black uppercase tracking-[0.26em] text-slate-500 sm:block">Immersive live auction</p>
            </div>
          </div>
          <span className={`ml-1 hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] sm:flex ${statusClasses(props.status)}`}>
            <span className={`h-1.5 w-1.5 rounded-full bg-current ${props.status === "live" ? "animate-pulse" : ""}`} />
            {props.status}
          </span>
          {props.currentRound ? (
            <span className="hidden max-w-[180px] truncate rounded-full bg-white/5 px-2.5 py-1 text-[9px] font-bold text-slate-400 ring-1 ring-white/8 lg:block">
              {props.currentRound.name}
            </span>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <div className="mr-1 hidden items-center gap-3 rounded-xl bg-black/20 px-3 py-2 text-[9px] text-slate-500 xl:flex">
            <span className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${props.connection === "connected" ? "bg-emerald-300" : props.connection === "offline" ? "bg-rose-400" : "animate-pulse bg-amber-300"}`} />
              {props.connection}
            </span>
            <span className="flex items-center gap-1"><Wifi className="h-3 w-3" /> {props.latencyMs || "—"}ms</span>
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {props.viewerCount}</span>
          </div>

          <div className="hidden items-center gap-1 md:flex">
            <IconAction label="Broadcast camera" active={props.cameraMode === "broadcast"} onClick={() => props.onCameraModeChange("broadcast")}>
              <Eye className="h-3.5 w-3.5" />
            </IconAction>
            <IconAction label="Stage camera" active={props.cameraMode === "stage"} onClick={() => props.onCameraModeChange("stage")}>
              <Focus className="h-3.5 w-3.5" />
            </IconAction>
            <IconAction label="Top view" active={props.cameraMode === "top"} onClick={() => props.onCameraModeChange("top")}>
              <ArrowUp className="h-3.5 w-3.5" />
            </IconAction>
            <IconAction label="Floor view" active={props.cameraMode === "floor"} onClick={() => props.onCameraModeChange("floor")}>
              <ArrowDown className="h-3.5 w-3.5" />
            </IconAction>
            <IconAction label="360° orbit and gesture camera" active={props.cameraMode === "orbit"} onClick={() => props.onCameraModeChange("orbit")}>
              <Orbit className="h-3.5 w-3.5" />
            </IconAction>
          </div>

          <IconAction label={`Rendering quality: ${props.quality}`} onClick={cycleQuality}>
            <Gauge className="h-3.5 w-3.5" />
            <span className="hidden xl:inline">{props.quality}</span>
          </IconAction>
          <IconAction
            label={cleanView ? "Show information panels (H)" : "Clean arena view (H)"}
            active={cleanView}
            onClick={() => {
              setDrawer(null);
              setCleanView((current) => !current);
            }}
          >
            {cleanView ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </IconAction>
          <IconAction label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"} onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </IconAction>
        </div>
      </header>

      {!cleanView ? (
        <div className="absolute left-4 top-[78px] hidden xl:block">
          <PlayerHudCard player={props.player} currentBid={props.currentBid} leadingFranchise={props.leadingFranchise} timer={props.timer} />
        </div>
      ) : null}

      {!cleanView ? (
        <div className="absolute right-4 top-[78px] hidden 2xl:block">
          <LivePulsePanel bids={props.bidHistory} franchises={props.franchises} players={props.players} viewerCount={props.viewerCount} />
        </div>
      ) : null}

      {!cleanView ? (
      <div className="pointer-events-auto absolute left-3 top-[76px] flex max-w-[calc(100vw-24px)] items-center gap-2 rounded-2xl border border-white/10 bg-[#050813]/76 p-2 backdrop-blur-xl xl:hidden">
        {props.player ? <TinyAvatar player={props.player} /> : <Gavel className="mx-2 h-4 w-4 text-slate-500" />}
        <div className="min-w-0 pr-1">
          <p className="max-w-[128px] truncate text-[11px] font-black text-white sm:max-w-[220px]">{props.player?.name ?? "Awaiting next lot"}</p>
          <p className="text-[9px] text-slate-500">{props.player ? formatLakhs(props.currentBid.amount) : props.status}</p>
        </div>
        <div className="h-7 w-px bg-white/10" />
        <span className={`font-mono text-xs font-black ${props.timer.remaining <= 5 && props.timer.remaining > 0 ? "text-rose-300" : "text-amber-200"}`}>
          {formatSeconds(props.timer.remaining)}
        </span>
      </div>
      ) : null}

      {!cleanView ? (
      <nav aria-label="Auction room panels" className="pointer-events-auto absolute bottom-[116px] left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-[14px] border border-white/10 bg-[#050813]/84 p-1 shadow-2xl backdrop-blur-2xl 2xl:bottom-4 2xl:left-auto 2xl:right-4 2xl:translate-x-0">
        <IconAction label="Live activity" active={drawer === "activity"} onClick={() => toggleDrawer("activity")}>
          <Activity className="h-3.5 w-3.5" /><span className="hidden sm:inline">Activity</span>
        </IconAction>
        <IconAction label="Franchises" active={drawer === "teams"} onClick={() => toggleDrawer("teams")}>
          <Users className="h-3.5 w-3.5" /><span className="hidden sm:inline">Teams</span>
        </IconAction>
        <IconAction label="Player queue" active={drawer === "queue"} onClick={() => toggleDrawer("queue")}>
          <ListOrdered className="h-3.5 w-3.5" /><span className="hidden sm:inline">Queue</span>
        </IconAction>
        {props.permissions.canManageAuction ? (
          <IconAction label="Organizer controls" active={drawer === "controls"} onClick={() => toggleDrawer("controls")}>
            <Settings2 className="h-3.5 w-3.5" /><span className="hidden sm:inline">Control</span>
          </IconAction>
        ) : null}
      </nav>
      ) : null}

      {!cleanView ? (
      <div className="pointer-events-none absolute bottom-3 left-3 hidden items-center gap-4 rounded-2xl border border-white/8 bg-[#050813]/55 px-3 py-2 text-[9px] text-slate-500 backdrop-blur-xl 2xl:flex">
        <span className="flex items-center gap-1.5"><Trophy className="h-3 w-3 text-emerald-300" /> {props.soldCount} sold</span>
        <span className="flex items-center gap-1.5"><CircleDollarSign className="h-3 w-3 text-amber-300" /> {formatLakhs(props.totalMoneySpent)}</span>
        <span className="flex items-center gap-1.5"><BarChart3 className="h-3 w-3 text-cyan-300" /> {completion.toFixed(0)}% settled</span>
      </div>
      ) : null}

      {!cleanView ? (
      <div className="pointer-events-none absolute bottom-[72px] right-4 hidden items-center gap-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 2xl:flex">
        <span className="flex items-center gap-1">
          <Gamepad2 className="h-3 w-3" />
          {props.cameraMode === "orbit"
            ? "Two-finger swipe: 360° + tilt · pinch: zoom"
            : "Choose orbit for touchpad gestures"}
        </span>
        <span>·</span>
        <span>B to bid · H clean view</span>
      </div>
      ) : null}

      <AnimatePresence>
        {drawer ? (
          <Drawer
            active={drawer}
            onClose={() => setDrawer(null)}
            onChange={(next) => setDrawer(next)}
            props={props}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
