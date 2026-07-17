import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";
import {
  Search,
  Trophy,
  CheckCircle2,
  X,
  AlertTriangle,
  Loader2,
  Ban,
  UserCheck,
  Shield,
  Clock,
  Filter,
  DollarSign,
  Pencil,
  IndianRupee,
  Tag,
  Info,
  Lock,
  Unlock,
  TrendingUp,
  Wallet,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Field";
import { TournamentCardSkeleton } from "@/components/ui/Skeleton";
import { PLAYER_ROLE_META } from "@/lib/constants/tournament";
import { formatCurrency, initials } from "@/lib/format";
import { format } from "date-fns";
import {
  usePlayers,
  useVerifyPlayer,
  useRejectPlayer,
  useSetPlayerBasePrice,
  useTeams,
} from "@/hooks/useRegistration";
import { getErrorMessage } from "@/lib/utils/errorMessage";
import type { Tournament } from "@/types/tournament";

/* ═════════════════════════════════════════════════════════════════
   TYPES
   ═════════════════════════════════════════════════════════════════ */
interface Player {
  id: string;
  name: string;
  role: string;
  basePrice: number;
  basePriceUpdatedAt?: string;
  status: string;
  lotOutcome: string;
  isSold: boolean;
  soldPrice?: number;
  userId?: string;
  createdAt?: string;
  /** Player.js's `profileImage` — an absolute http(s) URL, or absent if
   * the player never selected one. Falls back to initials when missing. */
  profileImage?: string;
}

type ModalType = "verify" | "reject" | "setBasePrice";

interface ModalState {
  isOpen: boolean;
  type: ModalType;
  player: Player | null;
}

/* ═════════════════════════════════════════════════════════════════
   PURSE CONSTRAINT ENGINE

   Business Rule: A player's base price MUST be strictly less than
   the minimum team purse across all registered teams. This ensures
   at least one team can afford to bid on every player.

   Edge Cases Handled:
   - No teams registered yet → use tournament.defaultPurse as fallback
   - Teams with 0 purse → basePrice must be < 0 (impossible, shows warning)
   - Tournament has no defaultPurse → no constraint (free market)
   ═════════════════════════════════════════════════════════════════ */

function usePurseConstraint(tournament: Tournament) {
  const { data: teams = [] } = useTeams(tournament.id);

  return useMemo(() => {
    // Extract all team purse values (initialBudget from wallet)
    const teamPurses = teams
      .map((t) => t.wallet?.initialBudget ?? t.purse ?? 0)
      .filter((p) => p > 0);

    const minTeamPurse = teamPurses.length > 0 ? Math.min(...teamPurses) : null;
    const hasTeams = teams.length > 0;
    const defaultPurse = (tournament as any).defaultPurse ?? null;

    // The absolute max base price is strictly less than min purse
    // If no teams yet, fall back to tournament defaultPurse
    const maxBasePrice =
      minTeamPurse !== null
        ? minTeamPurse
        : defaultPurse !== null
        ? defaultPurse
        : null;

    // Whether the constraint is active (we have a meaningful upper bound)
    const isConstrained = maxBasePrice !== null && maxBasePrice > 0;

    // How many teams have been registered
    const teamCount = teams.length;

    return {
      maxBasePrice,
      isConstrained,
      teamCount,
      minTeamPurse,
      defaultPurse,
      hasTeams,
    };
  }, [teams, tournament]);
}

/* ═════════════════════════════════════════════════════════════════
   AVATAR — shows profileImage when present, falls back to initials
   ═════════════════════════════════════════════════════════════════ */
function PlayerAvatar({
  name,
  image,
  sizeClass,
  fallbackClassName,
}: {
  name: string;
  image?: string | null;
  sizeClass: string;
  fallbackClassName: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!image && !failed;

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ring-1 ${sizeClass} ${
        showImage ? "bg-white ring-black/5" : fallbackClassName
      }`}
    >
      {showImage ? (
        <img
          src={image!}
          alt={name}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/* ═════════════════════════════════════════════════════════════════
   CONSTRAINT BADGE — shows purse limit context in the table
   ═════════════════════════════════════════════════════════════════ */
function PurseConstraintBadge({
  basePrice,
  maxBasePrice,
  currency,
  isConstrained,
}: {
  basePrice: number;
  maxBasePrice: number | null;
  currency: string;
  isConstrained: boolean;
}) {
  if (!isConstrained || maxBasePrice === null) return null;

  const isViolating = basePrice >= maxBasePrice;

  return (
    <span
      className={`ml-1.5 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-medium ${
        isViolating
          ? "bg-rose-100 text-rose-600 ring-1 ring-rose-200"
          : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
      }`}
      title={
        isViolating
          ? `Price exceeds max allowed (${formatCurrency(maxBasePrice, currency)})`
          : `Within limit (max: ${formatCurrency(maxBasePrice, currency)})`
      }
    >
      {isViolating ? (
        <Lock className="h-2.5 w-2.5" />
      ) : (
        <Unlock className="h-2.5 w-2.5" />
      )}
      {isViolating ? "Over limit" : "OK"}
    </span>
  );
}

/* ═════════════════════════════════════════════════════════════════
   MODAL CONFIG
   ═════════════════════════════════════════════════════════════════ */
const MODAL_META: Record<
  ModalType,
  {
    title: string;
    subtitle: string;
    icon: React.ElementType;
    confirmLabel: string;
    confirmIcon: React.ElementType;
    gradient: string;
    buttonBase: string;
    buttonHover: string;
    buttonText: string;
    requireReason: boolean;
    reasonLabel: string;
    reasonPlaceholder: string;
    inputType: "reason" | "price" | "none";
  }
> = {
  verify: {
    title: "Verify Player",
    subtitle:
      "This player will be verified and become eligible for the auction pool. Their base price will be locked.",
    icon: UserCheck,
    confirmLabel: "Verify Player",
    confirmIcon: CheckCircle2,
    gradient: "from-emerald-500 via-emerald-600 to-teal-700",
    buttonBase: "bg-emerald-600",
    buttonHover: "hover:bg-emerald-700",
    buttonText: "text-white",
    requireReason: false,
    reasonLabel: "",
    reasonPlaceholder: "",
    inputType: "none",
  },
  reject: {
    title: "Reject Player",
    subtitle:
      "This action will permanently reject this player registration. The player will be notified of the decision.",
    icon: Ban,
    confirmLabel: "Reject Player",
    confirmIcon: X,
    gradient: "from-rose-500 via-rose-600 to-red-700",
    buttonBase: "bg-rose-600",
    buttonHover: "hover:bg-rose-700",
    buttonText: "text-white",
    requireReason: true,
    reasonLabel: "Rejection reason",
    reasonPlaceholder: "Explain why this player registration is being rejected (required)...",
    inputType: "reason",
  },
  setBasePrice: {
    title: "Set Base Price",
    subtitle:
      "Update the base price for this player. This price will be used as the starting bid in the auction. Once the player is listed in a round, this can no longer be changed.",
    icon: DollarSign,
    confirmLabel: "Update Price",
    confirmIcon: CheckCircle2,
    gradient: "from-blue-500 via-blue-600 to-indigo-700",
    buttonBase: "bg-blue-600",
    buttonHover: "hover:bg-blue-700",
    buttonText: "text-white",
    requireReason: false,
    reasonLabel: "",
    reasonPlaceholder: "",
    inputType: "price",
  },
};

/* ═════════════════════════════════════════════════════════════════
   CONFIRMATION MODAL  —  Hooks always run first, zero conditionals

   Enhanced with purse constraint validation:
   - Shows max allowed price prominently
   - Validates basePrice < maxBasePrice
   - Visual feedback when constraint is violated
   - Contextual info about why the limit exists
   ═════════════════════════════════════════════════════════════════ */
function ConfirmModal({
  state,
  onClose,
  onConfirm,
  isLoading,
  error,
  currency,
  purseConstraint,
}: {
  state: ModalState;
  onClose: () => void;
  onConfirm: (value?: string | number) => void;
  isLoading: boolean;
  error: unknown;
  currency: string;
  purseConstraint: ReturnType<typeof usePurseConstraint>;
}) {
  const { type, player } = state;
  const [reason, setReason] = useState("");
  const [price, setPrice] = useState<string>("");
  const [priceError, setPriceError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const priceInputRef = useRef<HTMLInputElement>(null);

  const { maxBasePrice, isConstrained, teamCount, hasTeams } = purseConstraint;

  /* ── Hook 1: reset form when modal opens for a new target ── */
  useEffect(() => {
    if (state.isOpen) {
      setReason("");
      setPriceError(null);
      setTouched(false);
      if (type === "setBasePrice" && player) {
        setPrice(player.basePrice?.toString() ?? "");
        const timer = setTimeout(() => priceInputRef.current?.focus(), 250);
        return () => clearTimeout(timer);
      } else {
        setPrice("");
      }
    }
  }, [state.isOpen, type, player?.id, player?.basePrice]);

  /* ── Hook 2: Escape key to close ── */
  useEffect(() => {
    if (isLoading) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, isLoading]);

  /* ── Derived values (safe because hooks already ran) ── */
  const meta = player ? MODAL_META[type] : null;

  const validatePrice = (val: string): { valid: false } | { valid: true; value: number } => {
    if (val.trim() === "") return { valid: false };
    const num = Number(val);
    if (!Number.isFinite(num)) return { valid: false };
    if (num < 0) return { valid: false };
    if (!/^(\d+\.?\d{0,2})?$/.test(val)) return { valid: false };
    return { valid: true, value: num };
  };

  const priceValidation = validatePrice(price);
  const currentPrice = priceValidation.valid ? priceValidation.value : null;

  // Check purse constraint
  const isOverPurseLimit =
    isConstrained && maxBasePrice !== null && currentPrice !== null && currentPrice >= maxBasePrice;

  const canSubmit = (() => {
    if (!meta) return false;
    if (meta.inputType === "reason") {
      return reason.trim().length > 0;
    }
    if (meta.inputType === "price") {
      if (!priceValidation.valid) return false;
      if (isOverPurseLimit) return false;
      return true;
    }
    return true;
  })();

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === "" || /^\d*\.?\d{0,2}$/.test(raw)) {
      setPrice(raw);
      setPriceError(null);
      setTouched(true);
    }
  };

  const handleConfirm = () => {
    if (!meta || !player) return;
    if (meta.inputType === "reason") {
      if (!reason.trim()) return;
      onConfirm(reason.trim());
    } else if (meta.inputType === "price") {
      if (!priceValidation.valid) {
        setPriceError("Please enter a valid price (minimum 0, up to 2 decimal places)");
        return;
      }
      if (isOverPurseLimit) {
        setPriceError(
          `Base price must be less than ${formatCurrency(maxBasePrice!, currency)} (minimum team purse)`
        );
        return;
      }
      onConfirm(priceValidation.value);
    } else {
      onConfirm();
    }
  };

  /* ── Render ── */
  return (
    <AnimatePresence>
      {state.isOpen && player && meta && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={!isLoading ? onClose : undefined}
          />

          {/* Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/5"
          >
            {/* Header */}
            <div
              className={`relative overflow-hidden bg-gradient-to-br ${meta.gradient} px-6 pb-8 pt-8 text-center`}
            >
              <div
                className="absolute inset-0 opacity-[0.07]"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }}
              />
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md ring-1 ring-white/30"
              >
                <meta.icon className="h-8 w-8 text-white" strokeWidth={1.5} />
              </motion.div>
              <motion.h3
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="relative mt-4 text-xl font-bold tracking-tight text-white"
              >
                {meta.title}
              </motion.h3>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {/* Target preview */}
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5">
                  <PlayerAvatar
                    name={player.name}
                    image={player.profileImage}
                    sizeClass="h-10 w-10 text-sm"
                    fallbackClassName="bg-emerald-50 text-emerald-700 ring-emerald-100"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{player.name}</p>
                    <p className="text-xs text-slate-500">
                      {PLAYER_ROLE_META[player.role]?.label ?? player.role} ·{" "}
                      {formatCurrency(player.basePrice, currency)}
                    </p>
                  </div>
                </div>

                <p className="text-center text-sm leading-relaxed text-slate-600">
                  {meta.subtitle}
                </p>

                {/* ── Price Input ── */}
                {meta.inputType === "price" && (
                  <div className="mt-5 space-y-3">
                    {/* Purse constraint banner */}
                    {isConstrained && maxBasePrice !== null && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-xl border px-3 py-2.5 text-xs ${
                          isOverPurseLimit && touched
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-blue-200 bg-blue-50 text-blue-700"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {isOverPurseLimit && touched ? (
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
                          ) : (
                            <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                          )}
                          <div className="space-y-0.5">
                            <p className="font-semibold">
                              {isOverPurseLimit && touched
                                ? "Price exceeds team budget limit"
                                : "Team budget constraint active"}
                            </p>
                            <p className="text-slate-600">
                              Base price must be{" "}
                              <span className="font-bold">less than</span>{" "}
                              {formatCurrency(maxBasePrice, currency)} to ensure teams can
                              afford this player.
                              {!hasTeams && teamCount === 0 && (
                                <span className="block mt-0.5 text-slate-400">
                                  (Based on tournament default purse — no teams registered yet)
                                </span>
                              )}
                              {hasTeams && (
                                <span className="block mt-0.5 text-slate-400">
                                  (Minimum purse across {teamCount} registered team
                                  {teamCount > 1 ? "s" : ""})
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {!isConstrained && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                        <div className="flex items-start gap-2">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                          <p>
                            No team budget constraint available. Set any price ≥ 0.
                          </p>
                        </div>
                      </div>
                    )}

                    <label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5 text-blue-500" />
                        Base Price
                      </span>
                      <span className="text-xs font-normal text-slate-400">
                        {currency}
                      </span>
                    </label>

                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                        <IndianRupee className="h-4 w-4" />
                      </span>
                      <input
                        ref={priceInputRef}
                        type="text"
                        inputMode="decimal"
                        value={price}
                        onChange={handlePriceChange}
                        placeholder="Enter base price..."
                        className={`w-full rounded-xl border bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 transition-all focus:outline-none focus:ring-2 disabled:opacity-50 ${
                          isOverPurseLimit && touched
                            ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20"
                            : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/20"
                        }`}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && canSubmit) handleConfirm();
                        }}
                      />
                    </div>

                    {/* Validation messages */}
                    <div className="space-y-1">
                      {player.basePriceUpdatedAt && (
                        <p className="flex items-center gap-1 text-xs text-slate-400">
                          <Info className="h-3 w-3" />
                          Last updated{" "}
                          {format(new Date(player.basePriceUpdatedAt), "d MMM yyyy, h:mm a")}
                        </p>
                      )}
                      {priceError && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="text-xs text-rose-500"
                        >
                          {priceError}
                        </motion.p>
                      )}
                      {isOverPurseLimit && touched && !priceError && (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-xs text-rose-500"
                        >
                          Price must be less than {formatCurrency(maxBasePrice!, currency)}
                        </motion.p>
                      )}
                      <p className="text-xs text-slate-400">
                        Minimum: {formatCurrency(0, currency)}
                        {isConstrained && maxBasePrice !== null && (
                          <span className="mx-1">·</span>
                        )}
                        {isConstrained && maxBasePrice !== null && (
                          <span
                            className={
                              isOverPurseLimit && touched
                                ? "text-rose-400 font-medium"
                                : "text-blue-400"
                            }
                          >
                            Maximum: &lt;{formatCurrency(maxBasePrice, currency)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Rejection reason ── */}
                {meta.inputType === "reason" && (
                  <div className="mt-5">
                    <label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-700">
                      <span>{meta.reasonLabel}</span>
                      <span className="text-xs font-normal text-slate-400">
                        {reason.length}/500
                      </span>
                    </label>
                    <textarea
                      value={reason}
                      onChange={(e) => {
                        if (e.target.value.length <= 500) setReason(e.target.value);
                      }}
                      rows={3}
                      maxLength={500}
                      placeholder={meta.reasonPlaceholder}
                      className="w-full resize-none rounded-xl border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 placeholder:text-slate-400 transition-all focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      disabled={isLoading}
                    />
                    {reason.trim().length === 0 && (
                      <p className="mt-1.5 text-xs text-rose-500">
                        A reason is required to reject.
                      </p>
                    )}
                  </div>
                )}

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 flex items-start gap-2.5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 ring-1 ring-rose-200"
                    >
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                      <span>{getErrorMessage(error)}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isLoading || !canSubmit}
                onClick={handleConfirm}
                className={`inline-flex items-center rounded-xl px-5 py-2 text-sm font-semibold shadow-lg shadow-slate-900/10 transition-all disabled:opacity-50 disabled:shadow-none ${meta.buttonBase} ${meta.buttonHover} ${meta.buttonText}`}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <meta.confirmIcon className="mr-2 h-4 w-4" />
                )}
                {meta.confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═════════════════════════════════════════════════════════════════
   STATUS STYLES
   ═════════════════════════════════════════════════════════════════ */
const STATUS_STYLES: Record<string, { badge: string; dot: string; icon: React.ElementType }> = {
  PENDING: {
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    dot: "bg-amber-400",
    icon: Clock,
  },
  APPROVED: {
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-emerald-400",
    icon: CheckCircle2,
  },
  REJECTED: {
    badge: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
    dot: "bg-rose-400",
    icon: Ban,
  },
  REGISTERED: {
    badge: "bg-slate-50 text-slate-600 ring-1 ring-slate-200",
    dot: "bg-slate-400",
    icon: Shield,
  },
  SOLD: {
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  UNSOLD: {
    badge: "bg-rose-50 text-rose-600 ring-1 ring-rose-200",
    dot: "bg-rose-400",
    icon: Ban,
  },
};

function getStatusStyle(status?: string) {
  return STATUS_STYLES[status ?? ""] ?? STATUS_STYLES.PENDING;
}

/* ═════════════════════════════════════════════════════════════════
   PRICE BADGE — shows if price was manually set vs default
   With purse constraint indicator
   ═════════════════════════════════════════════════════════════════ */
function PriceBadge({
  basePrice,
  basePriceUpdatedAt,
  currency,
  maxBasePrice,
  isConstrained,
}: {
  basePrice: number;
  basePriceUpdatedAt?: string;
  currency: string;
  maxBasePrice: number | null;
  isConstrained: boolean;
}) {
  const isCustom = !!basePriceUpdatedAt;
  const isViolating = isConstrained && maxBasePrice !== null && basePrice >= maxBasePrice;

  return (
    <span className="group/price relative inline-flex items-center gap-1">
      <span
        className={`font-semibold ${
          isViolating ? "text-rose-600" : isCustom ? "text-blue-700" : "text-slate-700"
        }`}
      >
        {formatCurrency(basePrice, currency)}
      </span>
      {isCustom && (
        <span
          className="inline-flex h-1.5 w-1.5 rounded-full bg-blue-400"
          title="Price manually set by organizer"
        />
      )}
      {isViolating && (
        <span
          className="inline-flex h-1.5 w-1.5 rounded-full bg-rose-400"
          title={`Exceeds max allowed (${formatCurrency(maxBasePrice!, currency)})`}
        />
      )}
    </span>
  );
}

/* ═════════════════════════════════════════════════════════════════
   ACTION BUTTON — unified button component for table actions
   ═════════════════════════════════════════════════════════════════ */
function ActionButton({
  onClick,
  icon: Icon,
  label,
  variant,
  disabled,
  title,
}: {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  variant: "emerald" | "rose" | "blue" | "slate";
  disabled?: boolean;
  title?: string;
}) {
  const variants = {
    emerald: {
      base: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
      active: "active:scale-95",
    },
    rose: {
      base: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
      active: "active:scale-95",
    },
    blue: {
      base: "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100",
      active: "active:scale-95",
    },
    slate: {
      base: "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100",
      active: "",
    },
  };

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed ${variants[variant].base} ${variants[variant].active}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </motion.button>
  );
}

/* ═════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════════════════ */
export function PlayersTab({
  tournament,
  isOwner,
}: {
  tournament: Tournament;
  isOwner: boolean;
}) {
  const { data: players = [], isLoading, error } = usePlayers(tournament.id);
  const verifyPlayer = useVerifyPlayer(tournament.id);
  const rejectPlayer = useRejectPlayer(tournament.id);
  const setBasePrice = useSetPlayerBasePrice(tournament.id);
  const purseConstraint = usePurseConstraint(tournament);

  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: "verify",
    player: null,
  });

  const openModal = useCallback((type: ModalType, player: Player) => {
    setModal({ isOpen: true, type, player });
  }, []);

  const closeModal = useCallback(() => {
    if (verifyPlayer.isPending || rejectPlayer.isPending || setBasePrice.isPending) return;
    setModal((m) => ({ ...m, isOpen: false }));
    setTimeout(() => {
      setModal({ isOpen: false, type: "verify", player: null });
      verifyPlayer.reset();
      rejectPlayer.reset();
      setBasePrice.reset();
    }, 300);
  }, [verifyPlayer, rejectPlayer, setBasePrice]);

  const handleConfirm = useCallback(
    (value?: string | number) => {
      if (!modal.player) return;

      if (modal.type === "verify") {
        verifyPlayer.mutate(modal.player.id, { onSuccess: closeModal });
      } else if (modal.type === "reject") {
        if (typeof value !== "string" || !value.trim()) return;
        rejectPlayer.mutate(
          { registrationId: modal.player.id, reason: value.trim() },
          { onSuccess: closeModal }
        );
      } else if (modal.type === "setBasePrice") {
        if (typeof value !== "number" || value < 0 || !Number.isFinite(value)) return;
        setBasePrice.mutate(
          { registrationId: modal.player.id, basePrice: value },
          { onSuccess: closeModal }
        );
      }
    },
    [modal, verifyPlayer, rejectPlayer, setBasePrice, closeModal]
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-rose-200 bg-rose-50/50 p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500" />
        <p className="mt-3 text-sm font-medium text-rose-800">Failed to load players</p>
        <p className="mt-1 text-xs text-rose-600">{getErrorMessage(error)}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TournamentCardSkeleton />
        <TournamentCardSkeleton />
        <TournamentCardSkeleton />
        <TournamentCardSkeleton />
      </div>
    );
  }

  if (!players?.length) {
    return (
      <EmptyState
        icon={Trophy}
        title="No players registered yet"
        description="Players who register for this tournament will appear here, ready for auction day."
      />
    );
  }

  const filtered = players.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  const pendingCount = players.filter((p) => p.status === "PENDING").length;
  const approvedCount = players.filter((p) => p.status === "APPROVED").length;
  const pricesSetCount = players.filter((p) => p.basePriceUpdatedAt).length;
  const violatingCount = players.filter((p) => {
    if (!purseConstraint.isConstrained || purseConstraint.maxBasePrice === null) return false;
    return p.basePrice >= purseConstraint.maxBasePrice;
  }).length;

  return (
    <div className="space-y-4">
      {/* Search & Stats bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-xs">
          <Input
            icon={<Search className="h-4 w-4 text-slate-400" />}
            placeholder="Search players…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {isOwner && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Pending badge */}
            {pendingCount > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-amber-200"
              >
                <Filter className="h-3.5 w-3.5" />
                {pendingCount} pending
              </motion.div>
            )}

            {/* Approved with price status */}
            {approvedCount > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {approvedCount} approved
              </motion.div>
            )}

            {/* Prices set */}
            {pricesSetCount > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-200"
              >
                <Tag className="h-3.5 w-3.5" />
                {pricesSetCount} price{pricesSetCount > 1 ? "s" : ""} set
              </motion.div>
            )}

            {/* Violations warning */}
            {violatingCount > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 ring-1 ring-rose-200"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                {violatingCount} over limit
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <LayoutGroup>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3">Player</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Base Price</th>
                  <th className="px-4 py-3">Status</th>
                  {isOwner && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence mode="popLayout">
                  {filtered.map((player, i) => {
                    const style = getStatusStyle(player.status);
                    const StatusIcon = style.icon;
                    const isPending = player.status === "PENDING";
                    const isApproved = player.status === "APPROVED";
                    const roleMeta = PLAYER_ROLE_META[player.role];

                    // STRICT RULE: Only APPROVED players can have base price set/edited
                    // AND must be NOT_LISTED and not sold (backend business rule)
                    const canEditPrice =
                      isOwner &&
                      isApproved &&
                      !player.isSold &&
                      player.lotOutcome === "NOT_LISTED";

                    // Check if this player's price violates the purse constraint
                    const isPriceViolating =
                      purseConstraint.isConstrained &&
                      purseConstraint.maxBasePrice !== null &&
                      player.basePrice >= purseConstraint.maxBasePrice;

                    return (
                      <motion.tr
                        key={player.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.4) }}
                        className={`group transition-colors hover:bg-slate-50/80 ${
                          isPending ? "bg-amber-50/20" : isApproved ? "bg-emerald-50/10" : ""
                        } ${isPriceViolating ? "ring-1 ring-inset ring-rose-100" : ""}`}
                      >
                        {/* Player */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <PlayerAvatar
                              name={player.name}
                              image={player.profileImage}
                              sizeClass="h-9 w-9 text-xs"
                              fallbackClassName={
                                roleMeta?.color
                                  ? `bg-${roleMeta.color}-50 text-${roleMeta.color}-700 ring-${roleMeta.color}-100`
                                  : "bg-emerald-50 text-emerald-700 ring-emerald-100"
                              }
                            />
                            <div>
                              <p className="font-medium text-slate-800">{player.name}</p>
                              {player.createdAt && (
                                <p className="text-[11px] text-slate-400">
                                  Registered {format(new Date(player.createdAt), "d MMM")}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Role */}
                        <td className="px-4 py-3">
                          <Badge className="bg-slate-100 text-slate-600">
                            {roleMeta?.label ?? player.role}
                          </Badge>
                        </td>

                        {/* Base Price */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <PriceBadge
                              basePrice={player.basePrice}
                              basePriceUpdatedAt={player.basePriceUpdatedAt}
                              currency={tournament.currency}
                              maxBasePrice={purseConstraint.maxBasePrice}
                              isConstrained={purseConstraint.isConstrained}
                            />
                            {isOwner && isPriceViolating && (
                              <span
                                className="inline-flex items-center rounded bg-rose-100 px-1 py-0.5 text-[10px] font-medium text-rose-600"
                                title={`Price exceeds max allowed: ${formatCurrency(
                                  purseConstraint.maxBasePrice!,
                                  tournament.currency
                                )}`}
                              >
                                <TrendingUp className="mr-0.5 h-2.5 w-2.5" />
                                Over
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${style.badge}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                            <StatusIcon className="h-3 w-3" />
                            {player.status}
                          </span>
                        </td>

                        {/* Actions */}
                        {isOwner && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Set/Edit Base Price — ONLY for APPROVED players */}
                              {canEditPrice && (
                                <ActionButton
                                  onClick={() => openModal("setBasePrice", player as Player)}
                                  icon={player.basePriceUpdatedAt ? Pencil : DollarSign}
                                  label={player.basePriceUpdatedAt ? "Edit Price" : "Set Price"}
                                  variant="blue"
                                  title={
                                    player.basePriceUpdatedAt
                                      ? "Edit base price"
                                      : "Set base price"
                                  }
                                />
                              )}

                              {/* Verify / Reject — only for PENDING */}
                              {isPending ? (
                                <>
                                  <ActionButton
                                    onClick={() => openModal("verify", player as Player)}
                                    icon={CheckCircle2}
                                    label="Verify"
                                    variant="emerald"
                                    title="Verify player"
                                  />
                                  <ActionButton
                                    onClick={() => openModal("reject", player as Player)}
                                    icon={Ban}
                                    label="Reject"
                                    variant="rose"
                                    title="Reject player"
                                  />
                                </>
                              ) : !canEditPrice ? (
                                <span className="text-xs text-slate-300">—</span>
                              ) : null}
                            </div>
                          </td>
                        )}
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Footer stats */}
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-400">
            <span>
              Showing {filtered.length} of {players.length} player
              {players.length !== 1 ? "s" : ""}
              {query && ` matching "${query}"`}
            </span>
            {isOwner && purseConstraint.isConstrained && purseConstraint.maxBasePrice !== null && (
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                Max base price: &lt;
                {formatCurrency(purseConstraint.maxBasePrice, tournament.currency)}
                {purseConstraint.hasTeams
                  ? ` (${purseConstraint.teamCount} team${purseConstraint.teamCount > 1 ? "s" : ""})`
                  : " (default)"}
              </span>
            )}
          </div>
        </div>
      </LayoutGroup>

      {/* Confirmation Modal */}
      <ConfirmModal
        state={modal}
        onClose={closeModal}
        onConfirm={handleConfirm}
        isLoading={verifyPlayer.isPending || rejectPlayer.isPending || setBasePrice.isPending}
        error={
          modal.type === "verify"
            ? verifyPlayer.error
            : modal.type === "reject"
            ? rejectPlayer.error
            : setBasePrice.error
        }
        currency={tournament.currency}
        purseConstraint={purseConstraint}
      />
    </div>
  );
}