import type { AuctionPermissions, AuctionStatus, BidIncrementTier } from "@/features/auction/types/index.types";
import { CRORE } from "@/features/auction/constants/index.constants";

// ---------------------------------------------------------------------------
// Money formatting (amounts are always stored internally in ₹ Lakhs)
// ---------------------------------------------------------------------------
export function formatLakhs(amount: number): string {
  if (amount >= CRORE) {
    const crore = amount / CRORE;
    return `₹${trimZero(crore)} Cr`;
  }
  return `₹${trimZero(amount)} L`;
}

function trimZero(value: number): string {
  return value % 1 === 0 ? value.toFixed(0) : value.toFixed(2);
}

export function formatCompact(amount: number): string {
  return formatLakhs(amount);
}

// ---------------------------------------------------------------------------
// Bid increment logic
// ---------------------------------------------------------------------------
export function getNextIncrement(current: number, tiers: BidIncrementTier[]): number {
  for (const tier of tiers) {
    if (tier.upTo === null || current < tier.upTo) return tier.increment;
  }
  return tiers[tiers.length - 1]?.increment ?? 5;
}

export function getNextBidAmount(current: number, tiers: BidIncrementTier[]): number {
  return current + getNextIncrement(current, tiers);
}

// ---------------------------------------------------------------------------
// Timer formatting
// ---------------------------------------------------------------------------
export function formatSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}

export function formatClockTime(date = new Date()): string {
  return date.toLocaleTimeString("en-IN", { hour12: false });
}

export function timeAgo(timestamp: number): string {
  const diff = Math.max(0, Date.now() - timestamp);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
}

// ---------------------------------------------------------------------------
// Permission helpers — pure functions of auction status + role
// ---------------------------------------------------------------------------
export function computePermissions(
  status: AuctionStatus,
  hasCurrentPlayer: boolean,
  isOrganizer: boolean
): AuctionPermissions {
  return {
    isOrganizer,
    canStart: isOrganizer && (status === "draft" || status === "scheduled"),
    canPause: isOrganizer && status === "live",
    canResume: isOrganizer && status === "paused",
    canOpenLot: isOrganizer && status === "live" && !hasCurrentPlayer,
    canComplete: isOrganizer && (status === "live" || status === "paused"),
    canBid: status === "live" && hasCurrentPlayer,
    canMarkSold: isOrganizer && status === "live" && hasCurrentPlayer,
    canMarkUnsold: isOrganizer && status === "live" && hasCurrentPlayer,
  };
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ---------------------------------------------------------------------------
// API / Error helpers
// ---------------------------------------------------------------------------
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred";
}

export function isAuthError(error: unknown): boolean {
  const msg = getApiErrorMessage(error).toLowerCase();
  return (
    msg.includes("unauthorized") ||
    msg.includes("forbidden") ||
    msg.includes("token") ||
    msg.includes("jwt")
  );
}