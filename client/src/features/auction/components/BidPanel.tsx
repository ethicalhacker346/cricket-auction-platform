import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Gavel,
  Loader2,
  Trophy,
  XCircle,
  Zap,
} from "lucide-react";
import { useBid, useLiveAuction, useAuth } from "@/features/auction/hooks/index.hook";
import { useRoleStore } from "@/features/auction/store/index.store";
import { formatLakhs, getNextIncrement } from "@/features/auction/utils/index.utils";
import { cn } from "@/utils/cn";

// ── Toast Types ─────────────────────────────────────────────────────────────
type ToastType = "success" | "error";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

// ── Component ───────────────────────────────────────────────────────────────
export function BidPanel({ teamId }: { teamId?: string }) {
  const userTeamId = useRoleStore((s) => s.userTeamId);
  const { user } = useAuth();
  const activeTeamId = teamId ?? userTeamId ?? user?.teamId;

  const { currentPlayer, currentBid, franchises, auction, status } = useLiveAuction();
  const { placeBid, isPlacing, lastError, flashSeq } = useBid(activeTeamId!);

  const franchise = franchises.find((f) => f.id === activeTeamId);
  const isLeading = currentBid.teamId === activeTeamId;

  // ── Viewport Breakpoint Detection (for toast physics direction) ─────────
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsDesktop(e.matches);
    handler(mql);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // ── Purse & Affordability ───────────────────────────────────────────────
  const remainingPurse = franchise
    ? franchise.purseTotal - franchise.spent - (franchise.reservedBudget || 0)
    : 0;

  const pursePercentage =
    franchise && franchise.purseTotal > 0
      ? Math.max(0, Math.min(100, (remainingPurse / franchise.purseTotal) * 100))
      : 0;

  const purseColor =
    pursePercentage > 50
      ? "bg-emerald-500"
      : pursePercentage > 20
        ? "bg-amber-500"
        : "bg-rose-500";

  // ── Bid Amount Logic (First Bid = Base Price) ───────────────────────────
  const increments = auction?.rules?.bidIncrements ?? [];

  const effectiveBidAmount = useMemo(() => {
    if (!currentPlayer) return 0;
    // CRITICAL: If no one has bid yet, the first bid must be the player's
    // base price — not an empty increment above zero.
    if (!currentBid.teamId) {
      return currentPlayer.basePrice;
    }
    // Subsequent bids follow normal increment rules.
    return getNextIncrement(currentBid.amount, increments) + currentBid.amount;
  }, [currentPlayer, currentBid.teamId, currentBid.amount, increments]);

  const quickJumps = useMemo(() => {
    if (!currentPlayer || !increments.length || !activeTeamId) return [];
    // Anchor jumps to base price when no bids exist yet; otherwise to current bid.
    const baseAmount = currentBid.teamId ? currentBid.amount : currentPlayer.basePrice;
    const inc = getNextIncrement(baseAmount, increments);
    return [1, 2, 5].map((mult) => baseAmount + inc * mult);
  }, [currentBid.amount, currentBid.teamId, currentPlayer, increments, activeTeamId]);

  const canAfford = effectiveBidAmount <= remainingPurse;
  const canBid =
    status === "live" &&
    !!currentPlayer &&
    !isLeading &&
    !!franchise &&
    !!activeTeamId &&
    canAfford;

  // ── Toast State Machine ─────────────────────────────────────────────────
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [shake, setShake] = useState(false);
  const pendingBidRef = useRef<number>(0);
  const prevFlashSeq = useRef(flashSeq);
  const prevErrorRef = useRef<string | null>(null);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    // PREPEND so newest is always first in the array — this lets us use
    // flex-col (mobile top) vs flex-col-reverse (desktop bottom) naturally.
    setToasts((prev) => [{ id, type, message }, ...prev]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Watch for success (flashSeq bumps on every successful bid in useBid)
  useEffect(() => {
    if (flashSeq !== prevFlashSeq.current && flashSeq > 0) {
      prevFlashSeq.current = flashSeq;
      addToast("success", `Bid placed: ${formatLakhs(pendingBidRef.current)}`);
    }
  }, [flashSeq, addToast]);

  // Watch for errors
  useEffect(() => {
    if (lastError && lastError !== prevErrorRef.current) {
      prevErrorRef.current = lastError;
      addToast("error", lastError);
      setShake(true);
      const t = setTimeout(() => setShake(false), 500);
      return () => clearTimeout(t);
    }
    if (!lastError) {
      prevErrorRef.current = null;
    }
  }, [lastError, addToast]);

  // ── Bid Handlers ────────────────────────────────────────────────────────
  const handlePlaceBid = useCallback(
    (amount?: number) => {
      if (!canBid || isPlacing) return;
      const bidAmount = amount ?? effectiveBidAmount;
      pendingBidRef.current = bidAmount;
      placeBid(bidAmount);
    },
    [canBid, isPlacing, effectiveBidAmount, placeBid]
  );

  // Keyboard shortcut: Spacebar to bid
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        canBid &&
        !isPlacing &&
        document.activeElement?.tagName !== "BUTTON"
      ) {
        e.preventDefault();
        handlePlaceBid();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canBid, isPlacing, handlePlaceBid]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          VIEWPORT-LEVEL TOAST STACK
          Mobile/Tablet (default):  top-4, centered, flex-col
          Large+ (lg:):             bottom-6 right-6, flex-col-reverse
         ═══════════════════════════════════════════════════════════════════ */}
      <div
        className={cn(
          "fixed z-[100] flex w-full gap-2 overflow-hidden px-4",
          "top-4 left-0 right-0 flex-col items-center",
          "lg:bottom-6 lg:right-6 lg:top-auto lg:left-auto lg:w-auto lg:flex-col-reverse lg:items-end lg:px-0",
          "max-h-[40vh] lg:max-h-[60vh]"
        )}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{
                opacity: 0,
                y: isDesktop ? 24 : -24,
                scale: 0.9,
              }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                y: isDesktop ? 12 : -12,
                scale: 0.9,
                transition: { duration: 0.2 },
              }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className={cn(
                "pointer-events-auto relative flex w-full max-w-sm items-center gap-2.5 overflow-hidden rounded-xl px-4 py-3 text-sm font-semibold shadow-2xl backdrop-blur-md lg:w-72",
                toast.type === "success"
                  ? "border border-emerald-500/20 bg-emerald-950/80 text-emerald-300"
                  : "border border-rose-500/20 bg-rose-950/80 text-rose-300"
              )}
            >
              {toast.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span className="truncate">{toast.message}</span>

              {/* Progress bar */}
              <motion.div
                className={cn(
                  "absolute bottom-0 left-0 h-[2px]",
                  toast.type === "success" ? "bg-emerald-400/40" : "bg-rose-400/40"
                )}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 4, ease: "linear" }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Bid Panel Card ──────────────────────────────────────────────── */}
      <motion.div
        animate={shake ? { x: [-6, 6, -6, 6, -3, 3, 0] } : {}}
        transition={{ duration: 0.45, ease: "easeInOut" }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ring-1 ring-white/10">
              <Gavel className="h-4 w-4 text-amber-400" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Bidding as
              </span>
              <span className="text-sm font-bold text-white">
                {franchise?.shortName ?? "—"}
              </span>
            </div>
          </div>

          {franchise && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                Purse Left
              </span>
              <span className="text-sm font-bold text-emerald-400">
                {formatLakhs(remainingPurse)}
              </span>
            </div>
          )}
        </div>

        {/* ── Purse Visualizer ────────────────────────────────────────── */}
        {franchise && (
          <div className="mb-5">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-white/5 ring-1 ring-white/5">
              <motion.div
                className={cn("h-full rounded-full", purseColor)}
                initial={{ width: 0 }}
                animate={{ width: `${pursePercentage}%` }}
                transition={{ duration: 1.2, ease: "circOut" }}
              />
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-slate-600">
              <span>{Math.round(pursePercentage)}% remaining</span>
              <span>of {formatLakhs(franchise.purseTotal)}</span>
            </div>
          </div>
        )}

        {/* ── Bid Amount Display ──────────────────────────────────────── */}
        {currentPlayer && (
          <div className="mb-5 text-center">
            <motion.p
              key={currentBid.teamId ?? "base"}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500"
            >
              {currentBid.teamId ? "Next Minimum Bid" : "Opening Bid — Base Price"}
            </motion.p>
            <motion.p
              key={effectiveBidAmount}
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="mt-1 text-3xl font-black tracking-tight text-white sm:text-4xl"
            >
              {formatLakhs(effectiveBidAmount)}
            </motion.p>
          </div>
        )}

        {/* ── Primary Bid Button ──────────────────────────────────────── */}
        <motion.button
          whileHover={canBid ? { scale: 1.015 } : {}}
          whileTap={canBid ? { scale: 0.985 } : {}}
          onClick={() => handlePlaceBid()}
          disabled={!canBid || isPlacing}
          className={cn(
            "group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl py-4 text-base font-bold transition-all disabled:cursor-not-allowed disabled:opacity-30",
            isLeading
              ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
              : canBid
                ? "bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
                : "bg-white/5 text-slate-500 ring-1 ring-white/10"
          )}
        >
          {canBid && !isLeading && (
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400/10 to-orange-500/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          )}

          {isPlacing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Placing bid…</span>
            </>
          ) : isLeading ? (
            <>
              <Trophy className="h-4 w-4 text-emerald-400" />
              <span>You&apos;re the highest bidder</span>
            </>
          ) : !currentPlayer ? (
            <span>Waiting for next lot</span>
          ) : !canAfford ? (
            <>
              <AlertCircle className="h-4 w-4" />
              <span>Insufficient purse</span>
            </>
          ) : (
            <>
              <Zap className="h-5 w-5 fill-current" />
              <span>Bid {formatLakhs(effectiveBidAmount)}</span>
              <span className="hidden text-xs font-semibold opacity-60 sm:inline">
                (Space)
              </span>
            </>
          )}
        </motion.button>

        {/* ── Quick Jump Chips ────────────────────────────────────────── */}
        <AnimatePresence>
          {quickJumps.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 grid grid-cols-3 gap-2"
            >
              {quickJumps.map((amount, idx) => {
                const labels = ["+1×", "+2×", "+5×"];
                const affordable = amount <= remainingPurse;
                const disabled = !canBid || isPlacing || !affordable;

                return (
                  <motion.button
                    key={amount}
                    whileHover={!disabled ? { y: -2 } : {}}
                    whileTap={!disabled ? { scale: 0.95 } : {}}
                    onClick={() => handlePlaceBid(amount)}
                    disabled={disabled}
                    className={cn(
                      "relative flex flex-col items-center justify-center gap-0.5 rounded-lg py-2.5 text-xs font-bold transition-all",
                      disabled
                        ? "cursor-not-allowed bg-white/[0.02] text-slate-700 ring-1 ring-white/5"
                        : "bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10 hover:ring-amber-500/30 hover:text-white"
                    )}
                  >
                    <span
                      className={cn(
                        "text-[10px] font-medium uppercase tracking-wider",
                        disabled ? "text-slate-700" : "text-slate-500"
                      )}
                    >
                      {labels[idx]}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap
                        className={cn(
                          "h-3 w-3",
                          disabled ? "text-slate-700" : "text-amber-400/80"
                        )}
                      />
                      {formatLakhs(amount)}
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Inline Status Messages ──────────────────────────────────── */}
        <div className="mt-4 space-y-1.5">
          <AnimatePresence mode="popLayout">
            {lastError && (
              <motion.p
                key="error"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-1.5 text-xs text-rose-400"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {lastError}
              </motion.p>
            )}
          </AnimatePresence>

          {!currentPlayer && (
            <p className="text-center text-xs text-slate-500">
              Bidding opens once a lot goes live.
            </p>
          )}
          {!franchise && (
            <p className="text-center text-xs text-rose-400">
              No franchise assigned to this account.
            </p>
          )}
          {!activeTeamId && (
            <p className="text-center text-xs text-rose-400">
              Team ID required for bidding.
            </p>
          )}
        </div>
      </motion.div>
    </>
  );
}