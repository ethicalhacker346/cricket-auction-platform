import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  Coins,
  Eye,
  Gavel,
  Info,
  Layers,
  Loader2,
  Save,
  ShieldAlert,
  Sparkles,
  Timer,
  TrendingUp,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { useAuction, useAuth } from "@/features/auction/hooks/index.hook";
import { useTournament } from "@/hooks/useTournaments";
import type { BidIncrementTier } from "@/features/auction/types/index.types";
import { DEFAULT_BID_INCREMENTS } from "@/features/auction/constants/index.constants";
import { formatLakhs, parseCompactAmount } from "@/features/auction/utils/index.utils";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tier presets — all values are RAW RUPEES, matching the API contract
// (Auction.bidIncrementTiers) exactly. There is no lakh-conversion layer
// anywhere in this file anymore: what the organizer types is what gets
// sent, and formatLakhs() is purely a display concern on top of it.
// ---------------------------------------------------------------------------
type TierPreset = {
  id: string;
  label: string;
  description: string;
  build: () => BidIncrementTier[];
};

const TIER_PRESETS: TierPreset[] = [
  {
    id: "standard",
    label: "Standard",
    description: "₹50K below 1Cr → ₹1L up to 5Cr → ₹2L above",
    build: () => [
      { upTo: 1_00_00_000, increment: 50_000 },
      { upTo: 5_00_00_000, increment: 1_00_000 },
      { upTo: null, increment: 2_00_000 },
    ],
  },
  {
    id: "high-value",
    label: "High-value",
    description: "₹1L below 2Cr → ₹2L up to 10Cr → ₹5L above",
    build: () => [
      { upTo: 2_00_00_000, increment: 1_00_000 },
      { upTo: 10_00_00_000, increment: 2_00_000 },
      { upTo: null, increment: 5_00_000 },
    ],
  },
  {
    id: "flat",
    label: "Flat rate",
    description: "One fixed increment for the entire auction",
    build: () => [{ upTo: null, increment: 50_000 }],
  },
];

// ---------------------------------------------------------------------------
// Tier validation
// ---------------------------------------------------------------------------
type TierValidation = { ok: true } | { ok: false; message: string };

function validateTiers(tiers: BidIncrementTier[]): TierValidation {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return { ok: false, message: "At least one bid increment tier is required." };
  }
  const openEnded = tiers.filter((t) => t.upTo === null);
  if (openEnded.length !== 1) {
    return { ok: false, message: "Exactly one tier must have no upper bound (blank = ∞)." };
  }
  const finite = tiers
    .filter((t): t is BidIncrementTier & { upTo: number } => t.upTo !== null)
    .sort((a, b) => a.upTo - b.upTo);
  for (let i = 1; i < finite.length; i += 1) {
    if (finite[i].upTo <= finite[i - 1].upTo) {
      return { ok: false, message: "Tier upper bounds must be strictly increasing." };
    }
  }
  if (tiers.some((t) => t.increment <= 0 || Number.isNaN(t.increment))) {
    return { ok: false, message: "All increments must be greater than 0." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

// ---------------------------------------------------------------------------
// CreateAuctionPage
// ---------------------------------------------------------------------------
export default function CreateAuctionPage() {
  const { isAuthenticated, hasHydrated, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { tournamentId } = useParams<{ tournamentId: string }>();
  const effectiveTournamentId = tournamentId;

  const {
    data: tournament,
    isLoading: tournamentLoading,
    isError: tournamentError,
  } = useTournament(effectiveTournamentId);

  const {
    auction,
    loading: auctionLoading,
    error: auctionError,
    actions,
  } = useAuction(effectiveTournamentId);

  // ── Ownership guard ──
  const isOwner = useMemo(() => {
    if (!isAuthenticated || !user || !tournament) return false;
    return user.role === "ORGANIZER" && user.id === tournament.organizerId;
  }, [isAuthenticated, user, tournament]);

  const isReadyForAuction = tournament?.status === "TEAMS_APPROVED";
  const auctionAlreadyExists = !!auction?.id;

  // ── Form state ──
  const [name, setName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [lotTimerSeconds, setLotTimerSeconds] = useState(30);
  const [bidResetSeconds, setBidResetSeconds] = useState(12);
  const [tiers, setTiers] = useState<BidIncrementTier[]>([...DEFAULT_BID_INCREMENTS]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  // ── CRITICAL FIX: track seed source so auction data can override tournament defaults ──
  const seedRef = useRef<"none" | "tournament" | "auction">("none");

  useEffect(() => {
    if (!auction && !tournament) return;

    if (auction && seedRef.current !== "auction") {
      seedRef.current = "auction";
      setName(auction.name ?? "");
      setScheduledAt(auction.scheduledAt ? auction.scheduledAt.slice(0, 16) : "");
      setLotTimerSeconds(auction.rules?.lotTimerSeconds ?? 30);
      setBidResetSeconds(auction.rules?.bidResetSeconds ?? 12);
      setTiers(
        auction.rules?.bidIncrements?.length
          ? [...auction.rules.bidIncrements]
          : [...DEFAULT_BID_INCREMENTS]
      );
      setTouched(false);
    } else if (tournament && seedRef.current === "none") {
      seedRef.current = "tournament";
      setLotTimerSeconds(tournament.lotTimerSeconds ?? 30);
      setScheduledAt(
        tournament.auctionDate ? new Date(tournament.auctionDate).toISOString().slice(0, 16) : ""
      );
      setTiers(
        tournament.minBidIncrement
          ? [{ upTo: null, increment: tournament.minBidIncrement }]
          : [...DEFAULT_BID_INCREMENTS]
      );
    }
  }, [auction, tournament]);

  // ── Warn on unsaved changes ──
  useEffect(() => {
    if (!touched) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [touched]);

  // ── Tier CRUD ──
  const updateTier = useCallback((index: number, patch: Partial<BidIncrementTier>) => {
    setTouched(true);
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }, []);

  const addTier = useCallback(() => {
    setTouched(true);
    setTiers((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      const STEP = 50_00_000; // +₹50L per new boundary — a sane default, fully editable after
      if (last && last.upTo === null) {
        const prevLast = next[next.length - 2];
        const base = prevLast ? prevLast.upTo ?? 0 : 0;
        last.upTo = base + STEP;
      }
      const newIncrement = last ? Math.max(last.increment, 1) : 50_000;
      return [...next, { upTo: null, increment: newIncrement }];
    });
  }, []);

  const removeTier = useCallback((index: number) => {
    setTouched(true);
    setTiers((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      const openCount = next.filter((t) => t.upTo === null).length;
      if (openCount === 0) {
        next[next.length - 1] = { ...next[next.length - 1], upTo: null };
      }
      return next;
    });
  }, []);

  const sortTiers = useCallback(() => {
    setTouched(true);
    setTiers((prev) => {
      const finite = prev
        .filter((t): t is BidIncrementTier & { upTo: number } => t.upTo !== null)
        .sort((a, b) => a.upTo - b.upTo);
      const open = prev.find((t) => t.upTo === null);
      return open ? [...finite, open] : finite;
    });
  }, []);

  const applyPreset = useCallback((preset: TierPreset) => {
    setTouched(true);
    setTiers(preset.build());
  }, []);

  const tierValidation = useMemo(() => validateTiers(tiers), [tiers]);
  const needsSort = useMemo(() => {
    if (tiers.length < 2) return false;
    const ups = tiers.map((t) => t.upTo ?? Infinity);
    for (let i = 1; i < ups.length; i++) if (ups[i] <= ups[i - 1]) return true;
    return false;
  }, [tiers]);

  // ── Save ──
  const handleSave = useCallback(async () => {
    if (!effectiveTournamentId || !isOwner) {
      setCreateError("No tournament selected or insufficient permissions.");
      return;
    }
    if (!isReadyForAuction && !auctionAlreadyExists) {
      setCreateError("Teams must be approved before creating an auction.");
      return;
    }
    if (!tierValidation.ok) {
      setCreateError(tierValidation.message);
      return;
    }

    const finalName = name.trim() || `${tournament?.name ?? "Tournament"} Auction`;
    if (finalName.length > 160) {
      setCreateError("Auction name must be 160 characters or fewer.");
      return;
    }

    setSaving(true);
    setCreateError(null);

    try {
      const tiersInRaw = tiers.map((t) => ({
        upTo: t.upTo,
        increment: Math.round(t.increment),
      }));

      const savedAuction = await actions.save({
        name: finalName,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        lotTimerSeconds,
        bidResetSeconds,
        bidIncrementTiers: tiersInRaw as BidIncrementTier[],
      });

      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      setTouched(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);

      if (!auctionAlreadyExists && savedAuction?.id) {
        setTimeout(() => {
          navigate(
            `/tournaments/${effectiveTournamentId}/auction/${savedAuction.id}/dashboard`,
            { replace: true }
          );
        }, 900);
      }
    } catch (err: any) {
      setCreateError(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  }, [
    effectiveTournamentId,
    isOwner,
    isReadyForAuction,
    auctionAlreadyExists,
    tierValidation,
    name,
    tournament?.name,
    scheduledAt,
    lotTimerSeconds,
    bidResetSeconds,
    tiers,
    actions,
    queryClient,
    navigate,
  ]);

  // ── Keyboard shortcut: Ctrl/Cmd + S ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!saving && !auctionLoading && !tournamentLoading) handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave, saving, auctionLoading, tournamentLoading]);

  // ── Render guards ──
  if (!hasHydrated) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-4 py-32 text-center">
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

  if (!effectiveTournamentId) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-4 py-32 text-center">
        <Info className="h-12 w-12 text-slate-500" />
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
      <div className="mx-auto max-w-5xl space-y-6 py-8">
        <SkeletonHeader />
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (tournamentError || !tournament) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-4 py-32 text-center">
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
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-4 py-32 text-center">
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
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-4 py-32 text-center">
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

  // ── Derived display ──
  const hasPurse = tournament.defaultPurse != null && Number.isFinite(tournament.defaultPurse);
  const pageTitle = auctionAlreadyExists ? "Edit Auction" : "Create Auction";
  const pageSubtitle = auctionAlreadyExists
    ? "Fine-tune rules and schedule before the live room opens."
    : "Configure the ground rules for your tournament auction.";

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-5xl space-y-6 pb-24 pt-6"
    >
      {/* ── Header ── */}
      <motion.div variants={cardVariants} className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <Gavel className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white">{pageTitle}</h1>
            <p className="text-sm text-slate-400">{pageSubtitle}</p>
          </div>
          {auctionAlreadyExists && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="ml-auto rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/20"
            >
              Exists
            </motion.span>
          )}
        </div>
        {(auctionError || createError) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {createError || auctionError}
          </motion.div>
        )}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Main Form Column ── */}
        <div className="space-y-6 lg:col-span-2">
          {/* Identity */}
          <SectionCard icon={<Sparkles className="h-4 w-4" />} title="Auction Identity">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Auction Name"
                value={name}
                onChange={(v) => {
                  setName(v);
                  setTouched(true);
                }}
                placeholder={`${tournament.name} Auction`}
                maxLength={160}
                icon={<Gavel className="h-4 w-4 text-slate-500" />}
              />
              <Field
                label="Scheduled At"
                type="datetime-local"
                value={scheduledAt}
                onChange={(v) => {
                  setScheduledAt(v);
                  setTouched(true);
                }}
                icon={<Clock className="h-4 w-4 text-slate-500" />}
              />
            </div>
          </SectionCard>

          {/* Timers */}
          <SectionCard icon={<Timer className="h-4 w-4" />} title="Timers & Pace">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Lot Timer
                  </label>
                  <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-mono text-amber-300">
                    {lotTimerSeconds}s
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={600}
                  step={5}
                  value={lotTimerSeconds}
                  onChange={(e) => {
                    setLotTimerSeconds(Number(e.target.value));
                    setTouched(true);
                  }}
                  className="w-full accent-amber-400"
                />
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>5s</span>
                  <span>600s</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  Time allowed for bidding on each player. Resets to{" "}
                  <span className="text-slate-300">{bidResetSeconds}s</span> when a new bid arrives.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Bid Reset Window
                  </label>
                  <span className="rounded-md bg-slate-800 px-2 py-0.5 text-xs font-mono text-amber-300">
                    {bidResetSeconds}s
                  </span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={120}
                  step={1}
                  value={bidResetSeconds}
                  onChange={(e) => {
                    setBidResetSeconds(Number(e.target.value));
                    setTouched(true);
                  }}
                  className="w-full accent-amber-400"
                />
                <div className="flex justify-between text-[10px] text-slate-600">
                  <span>3s</span>
                  <span>120s</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-500">
                  The &quot;sniper&quot; window. When a bid lands, the timer snaps to this value to
                  prevent last-second steals.
                </p>
              </div>
            </div>
          </SectionCard>

          {/* Bid Increment Tiers */}
          <SectionCard
            icon={<Coins className="h-4 w-4" />}
            title="Bid Increment Tiers"
            right={
              <div className="flex items-center gap-2">
                {needsSort && (
                  <button
                    onClick={sortTiers}
                    className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 ring-1 ring-amber-500/20 transition hover:bg-amber-500/20"
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    Sort
                  </button>
                )}
                <button
                  onClick={addTier}
                  className="flex items-center gap-1 rounded-lg bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10"
                >
                  + Add Tier
                </button>
              </div>
            }
          >
            {/* Natural-input hint */}
            <p className="mb-4 flex items-center gap-1.5 text-xs text-slate-500">
              <Info className="h-3.5 w-3.5 shrink-0 text-slate-600" />
              Type amounts naturally — <code className="rounded bg-white/5 px-1 py-0.5 text-slate-400">50000</code>,{" "}
              <code className="rounded bg-white/5 px-1 py-0.5 text-slate-400">50k</code>, or{" "}
              <code className="rounded bg-white/5 px-1 py-0.5 text-slate-400">1.5cr</code> all resolve to the same value.
            </p>

            {/* Presets */}
            <div className="mb-5 flex flex-wrap gap-2">
              {TIER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  title={preset.description}
                  className="group flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-amber-400/30 hover:bg-amber-500/[0.06] hover:text-amber-200"
                >
                  <Wand2 className="h-3 w-3 text-slate-500 transition group-hover:text-amber-400" />
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Live proportional ladder bar */}
            <TierLadderBar tiers={tiers} />

            <div className="mt-5 space-y-3">
              <AnimatePresence initial={false}>
                {tiers.map((tier, i) => (
                  <motion.div
                    key={`tier-${i}`}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12, transition: { duration: 0.15 } }}
                    className={cn(
                      "group relative grid grid-cols-[auto_1fr_1fr_auto] items-start gap-3 rounded-xl border p-3 transition",
                      needsSort && i > 0 && (tier.upTo ?? Infinity) <= (tiers[i - 1].upTo ?? Infinity)
                        ? "border-rose-500/30 bg-rose-500/[0.04]"
                        : "border-white/5 bg-white/[0.02] hover:border-white/10"
                    )}
                  >
                    <div className="mt-6 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-[11px] font-bold text-slate-500 ring-1 ring-white/5">
                      {i + 1}
                    </div>

                    <AmountInput
                      label="Up to"
                      value={tier.upTo}
                      onChange={(v) => updateTier(i, { upTo: v })}
                      placeholder="∞ (no limit)"
                      allowNull
                      helperWhenEmpty="No upper bound — open-ended tier"
                    />

                    <AmountInput
                      label="Increment"
                      value={tier.increment}
                      onChange={(v) => updateTier(i, { increment: v ?? 0 })}
                      placeholder="e.g. 50000"
                      prefix="+"
                      helperPrefix="Next bid = current + "
                    />

                    <button
                      onClick={() => removeTier(i)}
                      disabled={tiers.length <= 1}
                      className="mt-6 rounded-lg p-2 text-rose-400 transition hover:bg-rose-500/10 disabled:opacity-30"
                      title="Remove tier"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {!tierValidation.ok && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 flex items-center gap-1.5 text-xs text-rose-400"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {tierValidation.message}
              </motion.p>
            )}

            {needsSort && tierValidation.ok && (
              <p className="mt-3 text-xs text-amber-300/80">
                Tiers are out of order. Click &quot;Sort&quot; to fix.
              </p>
            )}
          </SectionCard>


          {/* Rules Preview */}
          <SectionCard icon={<Eye className="h-4 w-4" />} title="Rules Preview">
            <div className="rounded-xl border border-white/5 bg-slate-950/50 p-4">
              <TierLadder tiers={tiers} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <PreviewStat
                label="Lot Timer"
                value={`${lotTimerSeconds}s`}
                sub={`Resets to ${bidResetSeconds}s on bid`}
                icon={<Timer className="h-4 w-4 text-sky-400" />}
              />
              <PreviewStat
                label="Purse / Team"
                value={hasPurse ? formatLakhs(tournament.defaultPurse) : "—"}
                sub={`Squad of ${tournament.squadSize ?? "?"}`}
                icon={<Coins className="h-4 w-4 text-emerald-400" />}
              />
              <PreviewStat
                label="Total Tiers"
                value={String(tiers.length)}
                sub={tierValidation.ok ? "Valid configuration" : "Invalid"}
                icon={<TrendingUp className="h-4 w-4 text-amber-400" />}
                status={tierValidation.ok ? "ok" : "error"}
              />
            </div>
          </SectionCard>
        </div>

        {/* ── Sidebar Column ── */}
        <div className="space-y-6">
          {/* Tournament Context */}
          <SectionCard icon={<Info className="h-4 w-4" />} title="Tournament">
            <div className="space-y-3">
              <ContextRow label="Name" value={tournament.name} />
              <ContextRow label="Organizer" value={tournament.organizerName ?? tournament.organizerId} />
              <ContextRow label="Status" value={tournament.status} highlight />
              <ContextRow
                label="Purse"
                value={hasPurse ? formatLakhs(tournament.defaultPurse) : "—"}
              />
              <ContextRow label="Squad Size" value={tournament.squadSize ?? "—"} />
              <ContextRow label="Currency" value={tournament.currency ?? "INR"} />
            </div>
            <div className="mt-4 border-t border-white/5 pt-4">
              <Link
                to={`/tournaments/${tournament.id}`}
                className="flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-white"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Tournament
              </Link>
            </div>
          </SectionCard>

          {/* Quick Help */}
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <Zap className="h-3.5 w-3.5" />
              Pro Tips
            </h3>
            <ul className="space-y-2.5 text-xs leading-relaxed text-slate-500">
              <li className="flex gap-2">
                <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                Keep the bid reset window short (8–15s) to maintain pace.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                Use tiered increments to speed up high-value bidding.
              </li>
              <li className="flex gap-2">
                <span className="mt-1 block h-1 w-1 shrink-0 rounded-full bg-amber-400" />
                You can edit these rules anytime before going live.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ── Sticky Action Bar ── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            {touched && !saved && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xs text-amber-300"
              >
                Unsaved changes
              </motion.span>
            )}
            {saved && (
              <motion.span
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-1 text-xs text-emerald-300"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Saved successfully
              </motion.span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Link
              to={`/tournaments/${tournament.id}`}
              className="hidden items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10 sm:flex"
            >
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </Link>

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleSave}
              disabled={saving || auctionLoading || tournamentLoading || !tierValidation.ok}
              className={cn(
                "flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-6 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
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
              <span className="hidden rounded bg-slate-950/20 px-1.5 py-0.5 text-[10px] font-mono text-slate-900/70 sm:inline">
                ⌘S
              </span>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function SectionCard({
  icon,
  title,
  children,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <motion.div
      variants={cardVariants}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] shadow-sm shadow-black/20 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between border-b border-white/[0.04] px-6 py-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <span className="text-amber-400">{icon}</span>
          {title}
        </div>
        {right && <div>{right}</div>}
      </div>
      <div className="p-6">{children}</div>
    </motion.div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  maxLength,
  icon,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">{icon}</span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          className={cn(
            "w-full rounded-lg border border-white/10 bg-slate-950 py-2.5 text-sm text-white outline-none transition focus:border-amber-400/50 placeholder:text-slate-700",
            icon ? "pl-10 pr-3" : "px-3"
          )}
        />
      </div>
    </div>
  );
}

function ContextRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span
        className={cn(
          "font-medium",
          highlight ? "rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-300 ring-1 ring-amber-500/20" : "text-slate-300"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TierLadder({ tiers }: { tiers: BidIncrementTier[] }) {
  const sorted = useMemo(() => {
    const finite = tiers
      .filter((t): t is BidIncrementTier & { upTo: number } => t.upTo !== null)
      .sort((a, b) => a.upTo - b.upTo);
    const open = tiers.find((t) => t.upTo === null);
    return open ? [...finite, open] : finite;
  }, [tiers]);

  if (sorted.length === 0) {
    return <p className="text-xs text-slate-600">No tiers configured.</p>;
  }

  return (
    <div className="space-y-0">
      {sorted.map((tier, i) => {
        const prevUp = i > 0 ? sorted[i - 1].upTo ?? Infinity : 0;
        const isOpen = tier.upTo === null;
        return (
          <div
            key={i}
            className="group relative flex items-center gap-4 border-b border-white/[0.04] py-3 last:border-0"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-slate-500 ring-1 ring-white/5">
              {i + 1}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">
                {isOpen
                  ? `Above ${formatLakhs(prevUp)}`
                  : `${i === 0 ? "₹0" : formatLakhs(prevUp)} – ${formatLakhs(tier.upTo)}`}
              </p>
              <p className="text-xs text-slate-500">
                When current bid is in this range, next bid adds {formatLakhs(tier.increment)}
              </p>
            </div>
            <div className="rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 ring-1 ring-amber-500/20">
              +{formatLakhs(tier.increment)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Natural-language currency input. Accepts anything parseCompactAmount()
 * understands (raw digits, "50k", "1.5cr", comma-separated, …) and always
 * commits a raw rupee number (or null for an intentionally empty/open field)
 * up to the parent. Shows a live formatLakhs() preview as the person types,
 * so they get instant confirmation of what the shorthand resolves to.
 */
function AmountInput({
  label,
  value,
  onChange,
  placeholder,
  prefix = "₹",
  allowNull = false,
  helperWhenEmpty,
  helperPrefix = "",
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  prefix?: string;
  allowNull?: boolean;
  helperWhenEmpty?: string;
  helperPrefix?: string;
}) {
  const [text, setText] = useState(value != null ? String(value) : "");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(value != null ? String(value) : "");
  }, [value, focused]);

  const trimmed = text.trim();
  const parsed = trimmed === "" ? null : parseCompactAmount(trimmed);
  const isEmpty = trimmed === "";
  const isInvalid = !isEmpty && parsed == null;

  const commit = () => {
    setFocused(false);
    if (isEmpty) {
      if (allowNull) {
        onChange(null);
      } else {
        setText(value != null ? String(value) : "");
      }
      return;
    }
    if (parsed != null) {
      onChange(parsed);
      setText(String(parsed));
    } else {
      // Unparseable — revert to last committed value rather than accepting garbage.
      setText(value != null ? String(value) : "");
    }
  };

  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">
          {prefix}
        </span>
        <input
          type="text"
          inputMode="decimal"
          value={text}
          onFocus={() => setFocused(true)}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-lg border bg-slate-950 py-2 pl-6 pr-3 text-sm text-white outline-none transition placeholder:text-slate-700",
            isInvalid
              ? "border-rose-500/40 focus:border-rose-400/60"
              : "border-white/10 focus:border-amber-400/50"
          )}
        />
      </div>
      <p className={cn("mt-1 truncate text-[10px]", isInvalid ? "text-rose-400" : "text-slate-600")}>
        {isInvalid
          ? `Can't parse "${text}" — try 50000 or 50k`
          : isEmpty
          ? helperWhenEmpty ?? "\u00A0"
          : `${helperPrefix}${formatLakhs(parsed as number)}`}
      </p>
    </div>
  );
}

/**
 * Live, proportional visual of the current tier ladder — a single stacked
 * bar where each segment's width reflects that tier's share of the range,
 * so organizers can see relative jumps at a glance instead of just reading
 * numbers top to bottom. Uses a log scale so a ₹50K tier next to a
 * ₹5 Cr+ tier don't collapse the smaller one to an invisible sliver.
 */
function TierLadderBar({ tiers }: { tiers: BidIncrementTier[] }) {
  const segments = useMemo(() => {
    const finite = tiers
      .filter((t): t is BidIncrementTier & { upTo: number } => t.upTo !== null && t.upTo > 0)
      .sort((a, b) => a.upTo - b.upTo);
    const open = tiers.find((t) => t.upTo === null);

    const bounds: { from: number; to: number; increment: number; isOpen: boolean }[] = [];
    let prev = 0;
    for (const t of finite) {
      if (t.upTo > prev) bounds.push({ from: prev, to: t.upTo, increment: t.increment, isOpen: false });
      prev = t.upTo;
    }
    if (open) {
      // Give the open-ended tail a fixed visual span (2x the last boundary, or a floor)
      const tail = Math.max(prev * 0.6, 10_00_000);
      bounds.push({ from: prev, to: prev + tail, increment: open.increment, isOpen: true });
    }
    return bounds;
  }, [tiers]);

  if (segments.length === 0) {
    return <p className="text-xs text-slate-600">Add a tier to see the ladder.</p>;
  }

  const weights = segments.map((s) => Math.log(s.to - s.from + 1_000) + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-white/10">
        {segments.map((s, i) => (
          <div
            key={i}
            title={`${s.isOpen ? "Above" : "Up to"} ${formatLakhs(s.isOpen ? s.from : s.to)} → +${formatLakhs(s.increment)}`}
            style={{
              width: `${(weights[i] / totalWeight) * 100}%`,
              background: s.isOpen
                ? "linear-gradient(90deg, rgba(251,191,36,0.9), rgba(244,63,94,0.9))"
                : `rgba(251,191,36,${0.35 + (i / Math.max(segments.length - 1, 1)) * 0.5})`,
            }}
            className="h-full first:rounded-l-full last:rounded-r-full"
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-slate-600">
        <span>₹0</span>
        <span>{segments[segments.length - 1].isOpen ? "∞" : formatLakhs(segments[segments.length - 1].to)}</span>
      </div>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  sub,
  icon,
  status = "ok",
}: {
  label: string;
  value: string;
  sub: string;
  icon: React.ReactNode;
  status?: "ok" | "error";
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1",
          status === "ok"
            ? "bg-slate-900 ring-white/5"
            : "bg-rose-500/10 ring-rose-500/20"
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-bold text-slate-200">{value}</p>
        <p className={cn("text-[10px]", status === "ok" ? "text-slate-600" : "text-rose-400")}>
          {sub}
        </p>
      </div>
    </div>
  );
}

function SkeletonHeader() {
  return (
    <div className="space-y-2">
      <div className="h-8 w-64 animate-pulse rounded-lg bg-white/5" />
      <div className="h-4 w-96 animate-pulse rounded bg-white/[0.03]" />
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-6">
      <div className="mb-4 h-5 w-32 animate-pulse rounded bg-white/5" />
      <div className="space-y-3">
        <div className="h-10 w-full animate-pulse rounded-lg bg-white/[0.03]" />
        <div className="h-10 w-full animate-pulse rounded-lg bg-white/[0.03]" />
      </div>
    </div>
  );
}