import type { BidIncrementTier } from "@/features/auction/types/index.types";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://gullybid-api.up.railway.app/api/v1";

// Socket.IO endpoint — now actively used by AuctionEngine.ts.
export const WS_URL =
  import.meta.env.VITE_SOCKET_URL || "https://gullybid-api.up.railway.app";

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
export const ROUTES = {
  root: "/",
  dashboard: "/",
  create: "/create",
  rounds: "/rounds",
  roundEditor: "/rounds/:roundId",
  live: "/live",
  team: "/team",
  history: "/history",
  analytics: "/analytics",
  result: "/result",
} as const;


export const NAV_ITEMS = [
    {
        segment: "dashboard",
        label: "Dashboard",
        icon: "LayoutDashboard",
    },
    {
        segment: "configuration",
        label: "Configuration",
        icon: "Settings2",
    },
    {
        segment: "rounds",
        label: "Rounds",
        icon: "ListOrdered",
    },
    {
        segment: "live",
        label: "Live Auction",
        icon: "Gavel",
    },
    {
        segment: "team",
        label: "Team Console",
        icon: "Users",
    },
    {
        segment: "history",
        label: "Bid History",
        icon: "History",
    },
    {
        segment: "analytics",
        label: "Analytics",
        icon: "BarChart3",
    },
    {
        segment: "results",
        label: "Results",
        icon: "Trophy",
    },
];

// ---------------------------------------------------------------------------
// Domain defaults
// ---------------------------------------------------------------------------
export const DEFAULT_BID_INCREMENTS: BidIncrementTier[] = [
  { upTo: 100, increment: 5 },
  { upTo: 200, increment: 10 },
  { upTo: 500, increment: 20 },
  { upTo: 1000, increment: 25 },
  { upTo: null, increment: 50 },
];

export const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  scheduled: "bg-sky-500/15 text-sky-300 ring-sky-500/30",
  live: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  completed: "bg-violet-500/15 text-violet-300 ring-violet-500/30",
  pending: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
  active: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  sold: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  unsold: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  // NEW: terminal withdrawal state — neutral gray to distinguish from active unsold
  permanent_unsold: "bg-gray-500/15 text-gray-300 ring-gray-500/30",
  current: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
};

export const ROLE_ICONS: Record<string, string> = {
  Batter: "🏏",
  Bowler: "🎯",
  "All-Rounder": "⚡",
  "Wicket-Keeper": "🧤",
};

export const LOG_ICON: Record<string, string> = {
  start: "▶️",
  pause: "⏸️",
  resume: "⏵",
  lot_open: "📦",
  bid: "💰",
  sold: "🔨",
  unsold: "🚫",
  // NEW: align with AUCTION_LOG_ACTIONS v2 additions
  unsold_round_created: "🔄",
  round_complete: "🏁",
  complete: "🏆",
  connect: "🟢",
  disconnect: "🔴",
};

export const LOT_TIMER_SECONDS = 30;
export const BID_RESET_SECONDS = 12;
export const CRORE = 100; // 1 crore = 100 lakh

// ---------------------------------------------------------------------------
// Socket.IO event names — aligned with backend AUCTION_EVENTS
// ---------------------------------------------------------------------------
export const SOCKET_EVENTS = {
  // Auction lifecycle
  AUCTION_CREATED: "auction:created",
  AUCTION_STARTED: "auction:started",
  AUCTION_PAUSED: "auction:paused",
  AUCTION_RESUMED: "auction:resumed",
  AUCTION_COMPLETED: "auction:completed",
  RULES_UPDATED: "auction:rules:updated",

  // Round management
  ROUND_ADDED: "round:added",
  ROUND_UPDATED: "round:updated",
  ROUND_DELETED: "round:deleted",
  ROUND_COMPLETED: "round:completed",

  // Live bidding
  LOT_OPENED: "lot:opened",
  BID_PLACED: "bid:placed",
  LOT_SOLD: "lot:sold",
  LOT_UNSOLD: "lot:unsold",
  LOT_PERMANENT_UNSOLD: "lot:permanent_unsold",
  LIVE_STATE_UPDATED: "live:state:updated",

  // Presence
  VIEWER_COUNT_UPDATED: "viewer:count:updated",
} as const;