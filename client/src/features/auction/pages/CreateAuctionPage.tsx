import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Coins,
  Loader2,
  Save,
  Settings2,
  ShieldAlert,
  Timer,
  AlertTriangle,
  ArrowLeft,
  Gavel,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useAuction, useAuth } from "@/features/auction/hooks/index.hook";
import { useLiveAuctionStore } from "@/features/auction/store/index.store";
import { useTournament } from "@/hooks/useTournaments";
import type { BidIncrementTier } from "@/features/auction/types/index.types";
import { DEFAULT_BID_INCREMENTS } from "@/features/auction/constants/index.constants";
import { formatLakhs } from "@/features/auction/utils/index.utils";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Unit conversion helpers
// Backend stores raw currency (INR). Frontend domain uses lakhs (1 L = ₹100k).
// ---------------------------------------------------------------------------
const LAKH = 100_000;

function toLakhs(raw: number | undefined): number | null {
  if (raw == null || Number.isNaN(raw)) return null;
  return raw / LAKH;
}

function toRaw(lakhs: number | undefined): number | null {
  if (lakhs == null || Number.isNaN(lakhs)) return null;
  return Math.round(lakhs * LAKH);
}

// ---------------------------------------------------------------------------
// Tier validation — mirrors Auction.js validator so the user gets
// immediate feedback instead of a silent 400 from the backend.
// ---------------------------------------------------------------------------
function validateTiers(tiers: BidIncrementTier[]): string | null {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return "At least one bid increment tier is required.";
  }
  const openEnded = tiers.filter((t) => t.upTo === null);
  if (openEnded.length !== 1) {
    return "Exactly one tier must have no upper bound (blank = ∞).";
  }
  const finite = tiers
    .filter((t): t is BidIncrementTier & { upTo: number } => t.upTo !== null)
    .sort((a, b) => a.upTo - b.upTo);
  for (let i = 1; i < finite.length; i += 1) {
    if (finite[i].upTo <= finite[i - 1].upTo) {
      return "Tier upper bounds must be strictly increasing.";
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// CreateAuctionPage
// ---------------------------------------------------------------------------
export default function CreateAuctionPage() {
  const { isAuthenticated, hasHydrated, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const storeTournamentId = useLiveAuctionStore((s) => s.tournamentId);
  const setTournamentContext = useLiveAuctionStore((s) => s.setTournamentContext);
  const bootstrap = useLiveAuctionStore((s) => s.bootstrap);

  // Resolve tournament context: router state wins, then store, then undefined.
  const navTournamentId = (location.state as { tournamentId?: string } | null)?.tournamentId;
  const tournamentId = navTournamentId || storeTournamentId || undefined;

  // Sync router state into the store so anything else reading tournamentId
  // (breadcrumbs, subsequent bootstrap() calls) sees the right value.
  useEffect(() => {
    if (navTournamentId && navTournamentId !== storeTournamentId) {
      setTournamentContext(navTournamentId);
    }
  }, [navTournamentId, storeTournamentId, setTournamentContext]);

  // Fetch tournament details the same way TournamentPage does.
  const {
    data: tournament,
    isLoading: tournamentLoading,
    isError: tournamentError,
  } = useTournament(tournamentId);

  // Fetch existing auction (if any) for this tournament — turns this page
  // into an edit screen when the user refreshes after creation.
  const {
    auction,
    loading: auctionLoading,
    error: auctionError,
    actions,
  } = useAuction(tournamentId);

  // Ownership guard — must match TournamentPage exactly.
  const isOwner = useMemo(() => {
    if (!isAuthenticated || !user || !tournament) return false;
    return user.role === "ORGANIZER" && user.id === tournament.organizerId;
  }, [isAuthenticated, user, tournament]);

  // Backend requires TEAMS_APPROVED to create an auction.
  const isReadyForAuction = tournament?.status === "TEAMS_APPROVED";
  const auctionAlreadyExists = !!auction?.id;

  // Form state
  const [name, setName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [lotTimerSeconds, setLotTimerSeconds] = useState(30);
  const [bidResetSeconds, setBidResetSeconds] = useState(12);
  const [tiers, setTiers] = useState<BidIncrementTier[]>([...DEFAULT_BID_INCREMENTS]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const hasSeededRef = useRef(false);

  // Seed form from server state exactly once per mount so user edits are
  // never overwritten by a background refetch.
  useEffect(() => {
    if (hasSeededRef.current) return;
    if (!auction && !tournament) return;

    hasSeededRef.current = true;

    if (auction) {
      // Edit mode — seed from the existing auction document
      setName(auction.name ?? "");
      setScheduledAt(auction.scheduledAt ? auction.scheduledAt.slice(0, 16) : "");
      setLotTimerSeconds(auction.rules?.lotTimerSeconds ?? 30);
      setBidResetSeconds(auction.rules?.bidResetSeconds ?? 12);
      setTiers(
        auction.rules?.bidIncrements?.length
          ? [...auction.rules.bidIncrements]
          : [...DEFAULT_BID_INCREMENTS]
      );
    } else if (tournament) {
      // Create mode — seed from tournament defaults
      setLotTimerSeconds(tournament.lotTimerSeconds ?? 30);
      setScheduledAt(
        tournament.auctionDate ? new Date(tournament.auctionDate).toISOString().slice(0, 16) : ""
      );
      const incLakhs = toLakhs(tournament.minBidIncrement);
      if (incLakhs != null) {
        setTiers([{ upTo: null, increment: incLakhs }]);
      } else {
        setTiers([...DEFAULT_BID_INCREMENTS]);
      }
    }
  }, [auction, tournament]);

  // -----------------------------------------------------------------------
  // Tier CRUD
  // -----------------------------------------------------------------------
  const updateTier = useCallback((index: number, patch: Partial<BidIncrementTier>) => {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }, []);

  const addTier = useCallback(() => {
    setTiers((prev) => {
      // If the last tier is open-ended, give it a finite cap so the new
      // tier can become the new open-ended one. This keeps the ladder
      // valid without forcing the user to manually fix null collisions.
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.upTo === null) {
        const prevLast = next[next.length - 2];
        const base = prevLast ? prevLast.upTo ?? 0 : 0;
        last.upTo = base + 100; // sensible default; user can edit
      }
      return [...next, { upTo: null, increment: 5 }];
    });
  }, []);

  const removeTier = useCallback((index: number) => {
    setTiers((prev) => {
      if (prev.length <= 1) return prev; // backend requires ≥1 tier
      const next = prev.filter((_, i) => i !== index);
      // Ensure exactly one open-ended tier remains
      const openCount = next.filter((t) => t.upTo === null).length;
      if (openCount === 0) {
        next[next.length - 1] = { ...next[next.length - 1], upTo: null };
      }
      return next;
    });
  }, []);

  // -----------------------------------------------------------------------
  // Save
  // -----------------------------------------------------------------------
  const handleSave = useCallback(async () => {
    if (!tournamentId || !isOwner) {
      setCreateError("No tournament selected or insufficient permissions.");
      return;
    }
    if (!isReadyForAuction && !auctionAlreadyExists) {
      setCreateError("Teams must be approved before creating an auction.");
      return;
    }

    const tierError = validateTiers(tiers);
    if (tierError) {
      setCreateError(tierError);
      return;
    }

    // Name fallback so the backend never receives an empty optional
    const finalName = name.trim() || `${tournament?.name ?? "Tournament"} Auction`;
    if (finalName.length > 160) {
      setCreateError("Auction name must be 160 characters or fewer.");
      return;
    }

    setSaving(true);
    setCreateError(null);

    try {
      // Convert tier increments from lakhs (frontend domain) to raw INR
      // before sending to the backend. This aligns with the backend model
      // which stores raw currency units (see Auction.js bidIncrementTierSchema).
      const tiersInRaw = tiers.map((t) => ({
        upTo: t.upTo,
        increment: toRaw(t.increment) ?? t.increment,
      }));
      console.log({
        tiers,
        tiersInRaw,
        payload:{
          name: finalName,
          scheduledAt,
          lotTimerSeconds,
          bidResetSeconds,
          bidIncrementTiers: tiersInRaw,
        }
      });
      const savedAuction = await actions.save({
        name: finalName,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        lotTimerSeconds,
        bidResetSeconds,
        bidIncrementTiers: tiersInRaw as BidIncrementTier[],
      });

      // Tournament status flips to AUCTION_SCHEDULED on creation —
      // invalidate so TournamentPage and the dashboard show the new state.
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });

      setSaved(true);
      setTimeout(() => setSaved(false), 2200);

      // If this was a fresh creation, navigate to the auction dashboard
      // and bootstrap the live engine so the destination page has context.
      if (!auctionAlreadyExists && savedAuction?.id) {
        bootstrap(savedAuction.id, tournamentId);
        setTimeout(() => {
          navigate("/auctions/rounds", {
            state: {
              auctionId: savedAuction.id,
              tournamentId,
            },
            replace: true,
          });
        }, 800);
      }
    } catch (err: any) {
      setCreateError(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }, [
    tournamentId,
    isOwner,
    isReadyForAuction,
    auctionAlreadyExists,
    tiers,
    name,
    tournament?.name,
    scheduledAt,
    lotTimerSeconds,
    bidResetSeconds,
    actions,
    queryClient,
    bootstrap,
    navigate,
    auction?.id,
  ]);

  // -----------------------------------------------------------------------
  // Render guards
  // -----------------------------------------------------------------------
  if (!hasHydrated) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 py-32 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Authentication Required</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Only tournament organizers can create and configure auctions.
        </p>
        <Link
          to="/login"
          className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (!tournamentId) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 py-32 text-center">
        <Settings2 className="h-12 w-12 text-slate-500" />
        <h2 className="text-lg font-bold text-white">No Tournament Selected</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Select a tournament from the dashboard before configuring its auction.
        </p>
        <Link
          to="/"
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  if (tournamentLoading) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (tournamentError || !tournament) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 py-32 text-center">
        <AlertTriangle className="h-12 w-12 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Tournament Not Found</h2>
        <p className="max-w-sm text-sm text-slate-400">
          We couldn&apos;t load the tournament details. It may have been removed or you may not have access.
        </p>
        <Link
          to="/"
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
        >
          Go to Dashboard
        </Link>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 py-32 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Access Denied</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Only the tournament organizer ({tournament.organizerName || "Unknown"}) can configure the auction.
        </p>
        <Link
          to={`/tournaments/${tournament.id}`}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tournament
        </Link>
      </div>
    );
  }

  if (!isReadyForAuction && !auctionAlreadyExists) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 py-32 text-center">
        <AlertTriangle className="h-12 w-12 text-amber-400" />
        <h2 className="text-lg font-bold text-white">Tournament Not Ready</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Teams must be approved before you can create an auction. Current status:{" "}
          <span className="font-semibold text-amber-300">{tournament.status}</span>
        </p>
        <Link
          to={`/tournaments/${tournament.id}`}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tournament
        </Link>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Derived display values
  // -----------------------------------------------------------------------
  const purseLakhs = toLakhs(tournament.defaultPurse);
  const minBidLakhs = toLakhs(tournament.minBidIncrement);
  const pageTitle = auctionAlreadyExists ? "Edit Auction" : "Create Auction";
  const pageSubtitle = auctionAlreadyExists
    ? "Update rules and schedule before the live room opens."
    : "Set up the ground rules before the live room opens.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-4xl space-y-6"
    >
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Gavel className="h-5 w-5 text-amber-300" />
          <h1 className="text-2xl font-black text-white">{pageTitle}</h1>
          {auctionAlreadyExists && (
            <span className="ml-2 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
              Exists
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-500">{pageSubtitle}</p>
        {(auctionError || createError) && (
          <div className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-300">
            {createError || auctionError}
          </div>
        )}
      </div>

      {/* Tournament context (read-only) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-300">Tournament Context</p>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 ring-1 ring-white/10">
            Read-only
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ReadOnlyField label="Tournament Name" value={tournament.name ?? "—"} />
          <ReadOnlyField
            label="Organizer"
            value={tournament.organizerName ?? tournament.organizerId ?? "—"}
          />
          <ReadOnlyField
            label="Purse / Team"
            value={purseLakhs != null ? formatLakhs(purseLakhs) : "—"}
          />
          <ReadOnlyField
            label="Squad Size"
            value={tournament.squadSize != null ? String(tournament.squadSize) : "—"}
          />
          <ReadOnlyField
            label="Min Bid Increment"
            value={minBidLakhs != null ? formatLakhs(minBidLakhs) : "—"}
          />
          <ReadOnlyField
            label="Lot Timer (default)"
            value={tournament.lotTimerSeconds != null ? `${tournament.lotTimerSeconds}s` : "—"}
          />
          <ReadOnlyField
            label="Currency"
            value={tournament.currency ?? "INR"}
          />
          <ReadOnlyField
            label="Status"
            value={tournament.status ?? "—"}
          />
        </div>
      </div>

      {/* Basics */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="mb-4 text-sm font-semibold text-slate-300">Basics</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Auction Name"
            value={name}
            onChange={setName}
            placeholder={`${tournament.name} Auction`}
            maxLength={160}
          />
          <Field
            label="Scheduled At"
            type="datetime-local"
            value={scheduledAt}
            onChange={setScheduledAt}
          />
        </div>
      </div>

      {/* Timers & Rules */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-300">
          <Timer className="h-4 w-4" /> Timers & Rules
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <NumberField
            label="Lot Timer (s)"
            value={lotTimerSeconds}
            onChange={setLotTimerSeconds}
            min={5}
            max={600}
            help="5 – 600"
          />
          <NumberField
            label="Bid Reset (s)"
            value={bidResetSeconds}
            onChange={setBidResetSeconds}
            min={3}
            max={120}
            help="3 – 120"
          />
        </div>
      </div>

      {/* Bid Increment Tiers */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-300">
            <Coins className="h-4 w-4" /> Bid Increment Tiers
          </p>
          <button
            onClick={addTier}
            className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            + Add Tier
          </button>
        </div>

        <div className="space-y-2">
          {tiers.map((tier, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 rounded-xl bg-white/[0.02] p-3"
            >
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">
                  Up to (₹L, blank = ∞)
                </label>
                <input
                  type="number"
                  value={tier.upTo ?? ""}
                  onChange={(e) =>
                    updateTier(i, {
                      upTo: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-amber-400/50"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-500">
                  Increment (₹L)
                </label>
                <input
                  type="number"
                  value={tier.increment}
                  onChange={(e) => updateTier(i, { increment: Number(e.target.value) })}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-1.5 text-sm text-white outline-none focus:border-amber-400/50"
                />
              </div>
              <button
                onClick={() => removeTier(i)}
                disabled={tiers.length <= 1}
                className="mb-0.5 rounded-lg p-2 text-xs text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-30"
                title="Remove tier"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {validateTiers(tiers) && (
          <p className="mt-2 text-xs text-rose-400">{validateTiers(tiers)}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || auctionLoading || tournamentLoading}
          className={cn(
            "flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:opacity-50"
          )}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving…" : saved ? "Saved" : auctionAlreadyExists ? "Update Auction" : "Create Auction"}
        </button>

        <Link
          to={`/tournaments/${tournament.id}`}
          className="flex items-center gap-2 rounded-xl bg-white/5 px-5 py-3 text-sm font-semibold text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tournament
        </Link>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50 placeholder:text-slate-600"
      />
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-wider text-slate-500">{label}</label>
      <div className="mt-1 w-full rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-slate-300">
        {value}
      </div>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  help,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  help?: string;
}) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-wider text-slate-500">{label}</label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50"
      />
      {help && <p className="mt-1 text-[10px] text-slate-600">{help}</p>}
    </div>
  );
}