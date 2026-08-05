import type {
  AuctionPermission,
  AuctionPermissions,
  PermissionReason,
  AuctionStatus,
  BidIncrementTier,
} from "@/features/auction/types/index.types";
import { CRORE } from "@/features/auction/constants/index.constants";

export const AUCTION_PERMISSIONS: Record<string, AuctionPermission> = {
  MANAGE_AUCTION: "MANAGE_AUCTION",
  UPDATE_RULES: "UPDATE_RULES",
  MANAGE_ROUNDS: "MANAGE_ROUNDS",
  START_AUCTION: "START_AUCTION",
  PAUSE_AUCTION: "PAUSE_AUCTION",
  RESUME_AUCTION: "RESUME_AUCTION",
  COMPLETE_AUCTION: "COMPLETE_AUCTION",
  OPEN_LOT: "OPEN_LOT",
  SETTLE_LOT: "SETTLE_LOT",
  PLACE_BID: "PLACE_BID",
  MARK_PERMANENT_UNSOLD: "MARK_PERMANENT_UNSOLD",
};

const PERMISSION_KEYS = Object.values(AUCTION_PERMISSIONS);

const THOUSAND = 1_000;
const LAKH = 1_00_000;

/**
 * Formats a *raw rupee amount* into a compact Indian numbering string.
 *
 * Tiers:
 *   |amount| <  1,000                     -> as-is, no suffix     900        -> "₹900"
 *   |amount| <  1,00,000       (1 Lakh)    -> thousands, "K"       1,200      -> "₹1.2 K"
 *   |amount| <  1,00,00,000    (1 Crore)   -> lakhs, "L"           1,20,000   -> "₹1.2 L"
 *                                                                  1,45,000   -> "₹1.45 L"
 *   |amount| >= 1,00,00,000    (1 Crore)   -> crores, "Cr"         1,30,00,000 -> "₹1.3 Cr"
 *
 * - Never receives a pre-divided value (e.g. an amount already expressed in
 *   lakhs) — always pass the raw rupee amount. Dividing before calling this
 *   is the classic double-conversion bug (₹2.5 Cr getting rendered as "₹250 L").
 * - Trailing zeros after the decimal are trimmed (1.20 -> "1.2", 9.00 -> "9"),
 *   capped at 2 decimal places.
 * - Negative amounts mirror the same tiering with a leading "-" before the ₹.
 * - Non-finite input (NaN/±Infinity) safely falls back to "₹0".
 */
export function formatLakhs(amount: number): string {
  if (!Number.isFinite(amount)) return "₹0";

  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);

  if (abs < THOUSAND) return `${sign}₹${abs}`;
  if (abs < LAKH) return `${sign}₹${trimZero(abs / THOUSAND)} K`;
  if (abs < CRORE) return `${sign}₹${trimZero(abs / LAKH)} L`;
  return `${sign}₹${trimZero(abs / CRORE)} Cr`;
}

/** Rounds to `maxDecimals` places, then strips trailing zeros (and a trailing "."). */
function trimZero(value: number, maxDecimals = 2): string {
  return value.toFixed(maxDecimals).replace(/\.?0+$/, "");
}

export function formatCompact(amount: number): string { return formatLakhs(amount); }

/**
 * Parses a *natural, free-form* amount string typed by a user into a raw
 * rupee number — the input-side counterpart to {@link formatLakhs}.
 *
 * Accepts plain numbers, thousands separators, and compact shorthand
 * suffixes (case-insensitive, space before the suffix optional):
 *   "5000"       -> 5000
 *   "1,20,000"   -> 120000
 *   "50k"        -> 50000
 *   "1.5 L"      -> 150000        ("l" / "lac" / "lakh" / "lakhs")
 *   "2cr"        -> 20000000      ("cr" / "crore" / "crores")
 *
 * Returns `null` if the string isn't a parseable non-negative amount, so
 * callers can distinguish "invalid" from "zero" and show inline feedback
 * instead of silently coercing to 0.
 */
export function parseCompactAmount(input: string): number | null {
  if (typeof input !== "string") return null;

  const cleaned = input.trim().replace(/,/g, "");
  if (cleaned === "") return null;

  const match = cleaned.match(/^(\d+(?:\.\d+)?)\s*(k|l|lac|lakhs?|cr|crores?)?$/i);
  if (!match) return null;

  const [, numStr, suffixRaw] = match;
  const num = Number(numStr);
  if (!Number.isFinite(num)) return null;

  const suffix = suffixRaw?.toLowerCase();
  const multiplier =
    suffix === "k" ? THOUSAND
    : suffix === "l" || suffix === "lac" || suffix === "lakh" || suffix === "lakhs" ? LAKH
    : suffix === "cr" || suffix === "crore" || suffix === "crores" ? CRORE
    : 1;

  return Math.round(num * multiplier);
}

export function getNextIncrement(current: number, tiers: BidIncrementTier[]): number {
  for (const tier of tiers) if (tier.upTo === null || current < tier.upTo) return tier.increment;
  return tiers[tiers.length - 1]?.increment ?? 5;
}
export function getNextBidAmount(current: number, tiers: BidIncrementTier[]): number {
  return current + getNextIncrement(current, tiers);
}

export function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}
export function formatClockTime(date = new Date()): string { return date.toLocaleTimeString("en-IN", { hour12: false }); }
export function timeAgo(timestamp: number): string {
  const s = Math.floor(Math.max(0, Date.now() - timestamp) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

/**
 * Normalizes the backend permissions response. This is not an authorization
 * decision; it only protects the UI from partial/older API payloads.
 */
export function normalizeAuctionPermissions(raw: any): AuctionPermissions {
  const source = raw?.permissions ?? raw ?? {};
  const reasons = raw?.reasons ?? {};
  const value = (key: AuctionPermission, alias: string) =>
    Boolean(source[key] ?? raw?.[alias] ?? false);
  const reason = (key: AuctionPermission) => reasons[key] ?? (value(key, "") ? "ALLOWED" : "PERMISSION_DENIED");

  const permissions = Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, value(key, key)])
  ) as Record<AuctionPermission, boolean>;
  const normalizedReasons = Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, reason(key)])
  ) as Record<AuctionPermission, PermissionReason>;

  return {
    policyVersion: Number(raw?.policyVersion ?? 1),
    permissions,
    reasons: normalizedReasons,
    ownsAuction: Boolean(raw?.ownsAuction),
    ownsTournament: Boolean(raw?.ownsTournament),
    role: raw?.role ?? "PLAYER",
    auctionStatus: raw?.auctionStatus ?? "",
    canManageAuction: value("MANAGE_AUCTION", "canManageAuction"),
    canManageRounds: value("MANAGE_ROUNDS", "canManageRounds"),
    canUpdateRules: value("UPDATE_RULES", "canUpdateRules"),
    canAccessRoundManagement: value("MANAGE_ROUNDS", "canAccessRoundManagement"),
    canAccessAuctionControls: value("MANAGE_AUCTION", "canAccessAuctionControls"),
    canAccessRulesEditor: value("UPDATE_RULES", "canAccessRulesEditor"),
    canStart: value("START_AUCTION", "canStart"),
    canPause: value("PAUSE_AUCTION", "canPause"),
    canResume: value("RESUME_AUCTION", "canResume"),
    canOpenLot: value("OPEN_LOT", "canOpenLot"),
    canComplete: value("COMPLETE_AUCTION", "canComplete"),
    canBid: value("PLACE_BID", "canBid"),
    canMarkSold: value("SETTLE_LOT", "canMarkSold") || value("SETTLE_LOT", "canForceSold"),
    canMarkUnsold: value("SETTLE_LOT", "canMarkUnsold") || value("SETTLE_LOT", "canForceSold"),
    // NEW: permanent unsold capability
    canMarkPermanentUnsold: value("MARK_PERMANENT_UNSOLD", "canMarkPermanentUnsold"),
    ownsTournamentTeam:
      Boolean(raw?.ownsTournamentTeam),

    tournamentTeamApproved:
      Boolean(raw?.tournamentTeamApproved),

    tournamentTeamId:
      raw?.tournamentTeamId ?? null
    };
}

/**
 * Applies only transient live-screen constraints. The server permission remains
 * authoritative; this prevents showing an OPEN LOT button when a lot is active.
 */
export function withLiveStateConstraints(
  permissions: AuctionPermissions,
  hasCurrentPlayer: boolean
): AuctionPermissions {
  return {
    ...permissions,
    canOpenLot: permissions.canOpenLot && !hasCurrentPlayer,
    canBid: permissions.canBid && hasCurrentPlayer,
    canMarkSold: permissions.canMarkSold && hasCurrentPlayer,
    canMarkUnsold: permissions.canMarkUnsold && hasCurrentPlayer,
  };
}

/** @deprecated Do not derive authorization from role/status on the client. */
export function computePermissions(
  serverPermissions: AuctionPermissions,
  hasCurrentPlayer = false
): AuctionPermissions {
  return withLiveStateConstraints(serverPermissions, hasCurrentPlayer);
}

export function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }
export function uid(prefix = "id"): string { return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`; }
export function pickRandom<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
export function shuffle<T>(arr: T[]): T[] { const copy = [...arr]; for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
export function initials(name: string): string { return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(); }
export function getApiErrorMessage(error: unknown): string { if (error instanceof Error) return error.message; if (typeof error === "string") return error; return "An unexpected error occurred"; }
export function isAuthError(error: unknown): boolean { const msg = getApiErrorMessage(error).toLowerCase(); return msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("token") || msg.includes("jwt"); }
