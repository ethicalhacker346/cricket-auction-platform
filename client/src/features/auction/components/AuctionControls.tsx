import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Gavel,
  Hammer,
  Info,
  Loader2,
  Pause,
  Play,
  PowerOff,
  XCircle,
} from "lucide-react";
import { useAuctionPermissions, useLiveAuction } from "@/features/auction/hooks/index.hook";
import { formatLakhs } from "@/features/auction/utils/index.utils";
import { cn } from "@/utils/cn";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ConfirmConfig {
  title: string;
  description: string;
  action: () => Promise<void>;
  variant: "danger" | "warning" | "primary";
  confirmLabel: string;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl border backdrop-blur-md animate-in slide-in-from-bottom-3 fade-in duration-300",
        toast.type === "error" && "bg-rose-500/10 border-rose-500/20 text-rose-200",
        toast.type === "success" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-200",
        toast.type === "info" && "bg-sky-500/10 border-sky-500/20 text-sky-200"
      )}
    >
      {toast.type === "error" && <AlertTriangle className="h-4 w-4 shrink-0" />}
      {toast.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
      {toast.type === "info" && <Info className="h-4 w-4 shrink-0" />}
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
}

function ConfirmModal({
  config,
  onClose,
}: {
  config: ConfirmConfig | null;
  onClose: () => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!config) return null;

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await config.action();
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-center gap-3 mb-4">
          <div
            className={cn(
              "rounded-full p-2.5",
              config.variant === "danger" && "bg-rose-500/15 text-rose-400",
              config.variant === "warning" && "bg-amber-500/15 text-amber-400",
              config.variant === "primary" && "bg-emerald-500/15 text-emerald-400"
            )}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100">{config.title}</h3>
        </div>

        <p className="mb-6 text-sm leading-relaxed text-slate-400">{config.description}</p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-lg transition disabled:opacity-50",
              config.variant === "danger" &&
                "bg-rose-500 hover:bg-rose-400 shadow-rose-500/20",
              config.variant === "warning" &&
                "bg-amber-500 hover:bg-amber-400 shadow-amber-500/20 text-slate-950",
              config.variant === "primary" &&
                "bg-emerald-500 hover:bg-emerald-400 shadow-emerald-500/20"
            )}
          >
            {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
            {config.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  ControlButton                                                     */
/* ------------------------------------------------------------------ */

function ControlButton({
  onClick,
  disabled,
  icon: Icon,
  label,
  variant = "default",
  loading = false,
  title: tooltip,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ElementType;
  label: string;
  variant?: "default" | "primary" | "danger" | "success" | "warning" | "ghost";
  loading?: boolean;
  title?: string;
}) {
  const variants: Record<string, string> = {
    default:
      "bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10 hover:ring-white/20",
    primary:
      "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/25",
    danger:
      "bg-rose-500/90 text-white hover:bg-rose-500 shadow-lg shadow-rose-500/20",
    success:
      "bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-lg shadow-amber-400/20",
    warning:
      "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30 hover:bg-amber-500/30",
    ghost:
      "bg-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      title={tooltip || label}
      className={cn(
        "group relative flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all duration-200",
        "disabled:cursor-not-allowed disabled:opacity-30 disabled:shadow-none",
        variants[variant]
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4 transition-transform group-hover:scale-110" />
      )}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                    */
/* ------------------------------------------------------------------ */

export function AuctionControls() {
  const { actions, currentPlayer, currentRound, leadingFranchise, currentBid, auction, currentPlayerId } =
    useLiveAuction();
  const permissions = useAuctionPermissions();

  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirm, setConfirm] = useState<ConfirmConfig | null>(null);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  /* ---------------- Toasts ---------------- */
  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ---------------- Loading helpers ---------------- */
  const withAction = useCallback(
    async (
      key: string,
      action: () => Promise<{ success: boolean; error?: string }>,
      successMsg: string
    ) => {
      setLoading((p) => ({ ...p, [key]: true }));
      try {
        const res = await action();
        if (res.success) {
          showToast(successMsg, "success");
        } else {
          showToast(res.error || `${key} failed`, "error");
        }
      } catch (err: any) {
        showToast(err.message || "Unexpected error", "error");
      } finally {
        setLoading((p) => ({ ...p, [key]: false }));
      }
    },
    [showToast]
  );

  /* ---------------- Confirmation builders ---------------- */
  const openConfirm = useCallback((cfg: ConfirmConfig) => setConfirm(cfg), []);
  const closeConfirm = useCallback(() => setConfirm(null), []);

  /* ---------------- Handlers ---------------- */
  const onStart = () =>
    withAction("start", actions.start, "Auction started successfully");

  const onPause = () =>
    withAction("pause", actions.pause, "Auction paused");

  const onResume = () =>
    withAction("resume", actions.resume, "Auction resumed");

  const onComplete = () => {
    if (!permissions.canComplete) return;
    openConfirm({
      title: "Complete Auction",
      description:
        "This will permanently close the auction. No further bidding, lot openings, or player changes will be allowed. Are you sure?",
      variant: "danger",
      confirmLabel: "Complete Auction",
      action: () => withAction("complete", actions.complete, "Auction completed"),
    });
  };

  const onOpenNextLot = () =>
    withAction("openNextLot", actions.openNextLot, "Next lot opened");

  const onForceSold = () => {
    if (!currentPlayer) {
      showToast("No active player to settle", "error");
      return;
    }
    if (!currentBid.teamId) {
      showToast("No winning bid to force a sale", "error");
      return;
    }
    openConfirm({
      title: "Force Mark as Sold",
      description: `You are about to mark ${currentPlayer.name} as SOLD to ${
        leadingFranchise?.name || "highest bidder"
      } for ${formatLakhs(currentBid.amount)}. This action is irreversible and bypasses the timer.`,
      variant: "primary",
      confirmLabel: "Confirm Sale",
      action: () =>
        withAction("forceSold", actions.forceSold, `${currentPlayer.name} marked as sold`),
    });
  };

  const onForceUnsold = () => {
    if (!currentPlayer) {
      showToast("No active player to settle", "error");
      return;
    }
    openConfirm({
      title: "Mark as Unsold",
      description: `${currentPlayer.name} will be moved to the unsold pool and may be re-listed in the unsold round. Continue?`,
      variant: "warning",
      confirmLabel: "Confirm Unsold",
      action: () =>
        withAction("forceUnsold", actions.forceUnsold, `${currentPlayer.name} marked as unsold`),
    });
  };

  const onMarkPermanentUnsold = () => {
    if (!currentPlayer) {
      showToast("No active player to retire", "error");
      return;
    }
    openConfirm({
      title: "Permanently Retire Player",
      description: `${currentPlayer.name} will be permanently withdrawn from the auction and will never be re-listed. This is a terminal state — the auction can only complete once all remaining players are sold or permanently retired. Are you absolutely sure?`,
      variant: "danger",
      confirmLabel: "Retire Permanently",
      action: () =>
        withAction(
          "markPermanentUnsold",
          () => actions.markPermanentUnsold(currentPlayer.id),
          `${currentPlayer.name} permanently retired`
        ),
    });
  };

  /* ---------------- Derived UI state ---------------- */
  const isUnsoldRound = currentRound?.type === "unsold";
  console.log({
    currentRound,
    type: currentRound?.type,
    isUnsoldRound,
  });
  console.log({
    currentPlayerId,
    currentPlayer: currentPlayer?.name,
    canMarkPermanentUnsold: permissions.canMarkPermanentUnsold,
    reason:
      permissions.reasons?.MARK_PERMANENT_UNSOLD,
    role: permissions.role,
    ownsAuction: permissions.ownsAuction,
    auctionStatus: permissions.auctionStatus,
  }); 
  const statusColor =
    {
      draft: "bg-slate-500/15 text-slate-300",
      scheduled: "bg-sky-500/15 text-sky-300",
      live: "bg-emerald-500/15 text-emerald-300",
      paused: "bg-amber-500/15 text-amber-300",
      completed: "bg-violet-500/15 text-violet-300",
    }[auction?.status || "draft"] || "bg-slate-500/15 text-slate-300";

  if (permissions.loading) {
    return (
      <div className="flex h-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-400">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading organizer permissions…
      </div>
    );
  }

  const noOrganizerAccess =
    !permissions.canStart &&
    !permissions.canPause &&
    !permissions.canResume &&
    !permissions.canComplete &&
    !permissions.canOpenLot &&
    !permissions.canMarkSold &&
    !permissions.canMarkUnsold &&
    !permissions.canMarkPermanentUnsold;

  if (noOrganizerAccess && !permissions.loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-slate-500">
        <PowerOff className="h-4 w-4" />
        <span className="text-sm">Switch to Organizer view to control the auction</span>
      </div>
    );
  }

  return (
    <>
      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onDismiss={dismissToast} />
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal config={confirm} onClose={closeConfirm} />

      {/* Main Control Surface */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-xl backdrop-blur-sm">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              Auction Controls
            </h3>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize",
                statusColor
              )}
            >
              {auction?.status || "draft"}
            </span>
            {auction?.status === "live" && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>
          {currentPlayer && (
            <div className="hidden text-xs text-slate-500 md:block">
              Current: <span className="font-medium text-slate-300">{currentPlayer.name}</span>
              {isUnsoldRound && (
                <span className="ml-2 rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-400">
                  Unsold Round
                </span>
              )}
            </div>
          )}
        </div>

        {/* Button Groups */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Lifecycle */}
          <ControlButton
            icon={Play}
            label="Start"
            variant="primary"
            loading={loading.start}
            onClick={onStart}
            disabled={!permissions.canStart}
            title={!permissions.canStart ? "Auction cannot be started now" : "Start Auction"}
          />
          <ControlButton
            icon={Pause}
            label="Pause"
            variant="warning"
            loading={loading.pause}
            onClick={onPause}
            disabled={!permissions.canPause}
            title={!permissions.canPause ? "Auction is not live" : "Pause Auction"}
          />
          <ControlButton
            icon={Play}
            label="Resume"
            variant="primary"
            loading={loading.resume}
            onClick={onResume}
            disabled={!permissions.canResume}
            title={!permissions.canResume ? "Auction is not paused" : "Resume Auction"}
          />
          <ControlButton
            icon={CheckCircle2}
            label="Complete"
            variant="danger"
            loading={loading.complete}
            onClick={onComplete}
            disabled={!permissions.canComplete}
            title={!permissions.canComplete ? "Cannot complete auction yet" : "Complete Auction"}
          />

          <div className="mx-1 hidden h-8 w-px bg-white/10 sm:block" />

          {/* Lot Management */}
          <ControlButton
            icon={Gavel}
            label="Open Next Lot"
            variant="success"
            loading={loading.openNextLot}
            onClick={onOpenNextLot}
            disabled={!permissions.canOpenLot}
            title={!permissions.canOpenLot ? "Wait for current lot to settle" : "Open Next Lot"}
          />

          <div className="mx-1 hidden h-8 w-px bg-white/10 sm:block" />

          {/* Adjudication */}
          <ControlButton
            icon={Hammer}
            label="Force Sold"
            loading={loading.forceSold}
            onClick={onForceSold}
            disabled={!permissions.canMarkSold || !currentPlayerId}
            title={
              !permissions.canMarkSold
                ? "You do not have permission"
                : !currentPlayerId
                ? "No active lot"
                : "Force mark as sold immediately"
            }
          />

          {/*
            CRITICAL FIX:
            - Normal round  → show Force Unsold (moves player to unsold pool for re-listing)
            - Unsold round  → show Retire Player (permanent unsold, terminal state)
            The two buttons are mutually exclusive by round type.
          */}
          {!isUnsoldRound ? (
            <ControlButton
              icon={XCircle}
              label="Force Unsold"
              loading={loading.forceUnsold}
              onClick={onForceUnsold}
              disabled={!permissions.canMarkUnsold || !currentPlayerId}
              title={
                !permissions.canMarkUnsold
                  ? "You do not have permission"
                  : !currentPlayerId
                  ? "No active lot"
                  : "Move player to unsold pool"
              }
            />
          ) : (
            <ControlButton
              icon={Ban}
              label="Retire Player"
              variant="ghost"
              loading={loading.markPermanentUnsold}
              onClick={onMarkPermanentUnsold}
              disabled={!permissions.canMarkPermanentUnsold || !currentPlayerId}
              title={
                !permissions.canMarkPermanentUnsold
                  ? "You do not have permission"
                  : !currentPlayerId
                  ? "No active player"
                  : "Permanently retire from auction"
              }
            />
          )}
        </div>

        {/* Contextual micro-copy */}
        {isUnsoldRound && currentPlayer && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-800/40 px-3 py-2 text-xs text-slate-400 ring-1 ring-white/5">
            <Info className="h-3.5 w-3.5 text-sky-400" />
            <span>
              Unsold Round: {currentPlayer.name} can be re-bid on, or permanently retired to allow
              auction completion.
            </span>
          </div>
        )}
      </div>
    </>
  );
}