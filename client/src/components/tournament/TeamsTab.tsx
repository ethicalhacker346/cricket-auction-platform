import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCheck,
  Users2,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Crown,
  Shield,
  Clock,
  Ban,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { TournamentCardSkeleton } from "@/components/ui/Skeleton";
import { TEAM_STATUS_META } from "@/lib/constants/tournament";
import { formatCurrency } from "@/lib/format";
import { useTeams, useApproveTeam, useRejectTeam } from "@/hooks/useRegistration";
import { useMarkTeamsApproved } from "@/hooks/useTournaments";
import { getErrorMessage } from "@/lib/utils/errorMessage";
import type { Tournament } from "@/types/tournament";

/* ═════════════════════════════════════════════════════════════════
   TYPES
   ═════════════════════════════════════════════════════════════════ */
interface Team {
  id: string;
  name: string;
  status: string;
  brandColor: string;
  shortCode: string;
  ownerName: string;
  city?: string;
  purse: number;
  createdAt: string;
  /** Franchise.js's `logo` — an absolute http(s) URL, or absent if the
   * franchise never selected one. Falls back to shortCode when missing. */
  logo?: string;
}

/* ═════════════════════════════════════════════════════════════════
   AVATAR — shows the franchise logo when present, falls back to shortCode
   ═════════════════════════════════════════════════════════════════ */
function TeamAvatar({
  name,
  shortCode,
  image,
  brandColor,
  sizeClass,
}: {
  name: string;
  shortCode: string;
  image?: string | null;
  brandColor: string;
  /** e.g. "h-10 w-10 text-sm" */
  sizeClass: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = !!image && !failed;

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-bold text-white shadow-sm ring-1 ring-black/5 ${sizeClass}`}
      style={showImage ? undefined : { backgroundColor: brandColor }}
    >
      {showImage ? (
        <img
          src={image!}
          alt={name}
          onError={() => setFailed(true)}
          className="h-full w-full bg-white object-contain p-1"
        />
      ) : (
        shortCode
      )}
    </span>
  );
}

type ModalType = "approve" | "reject";

interface ModalState {
  isOpen: boolean;
  type: ModalType;
  team: Team | null;
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
  }
> = {
  approve: {
    title: "Approve Franchise",
    subtitle:
      "This franchise will be approved to participate in the tournament and will be assigned a tournament purse.",
    icon: Crown,
    confirmLabel: "Approve Franchise",
    confirmIcon: CheckCircle2,
    gradient: "from-emerald-500 via-emerald-600 to-teal-700",
    buttonBase: "bg-emerald-600",
    buttonHover: "hover:bg-emerald-700",
    buttonText: "text-white",
    requireReason: false,
    reasonLabel: "",
    reasonPlaceholder: "",
  },
  reject: {
    title: "Reject Franchise",
    subtitle:
      "This action will permanently reject this franchise registration. The owner will be notified of the decision.",
    icon: Ban,
    confirmLabel: "Reject Franchise",
    confirmIcon: X,
    gradient: "from-rose-500 via-rose-600 to-red-700",
    buttonBase: "bg-rose-600",
    buttonHover: "hover:bg-rose-700",
    buttonText: "text-white",
    requireReason: true,
    reasonLabel: "Rejection reason",
    reasonPlaceholder: "Explain why this franchise is being rejected (required)...",
  },
};

/* ═════════════════════════════════════════════════════════════════
   CONFIRMATION MODAL  —  Hooks always run first, zero conditionals
   ═════════════════════════════════════════════════════════════════ */
function ConfirmModal({
  state,
  onClose,
  onConfirm,
  isLoading,
  error,
}: {
  state: ModalState;
  onClose: () => void;
  onConfirm: (reason?: string) => void;
  isLoading: boolean;
  error: unknown;
}) {
  const { type, team } = state;
  const [reason, setReason] = useState("");

  /* ── Hook 1: reset reason when modal opens for a new target ── */
  useEffect(() => {
    if (state.isOpen) setReason("");
  }, [state.isOpen, state.team?.id]);

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
  const meta = team ? MODAL_META[type] : null;
  const canSubmit = meta ? !meta.requireReason || reason.trim().length > 0 : false;

  /* ── Render ── */
  return (
    <AnimatePresence>
      {state.isOpen && team && meta && (
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
                  <TeamAvatar
                    name={team.name}
                    shortCode={team.shortCode}
                    image={team.logo}
                    brandColor={team.brandColor}
                    sizeClass="h-10 w-10 text-sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{team.name}</p>
                    <p className="text-xs text-slate-500">Owner: {team.ownerName}</p>
                  </div>
                </div>

                <p className="text-center text-sm leading-relaxed text-slate-600">
                  {meta.subtitle}
                </p>

                {/* Rejection reason */}
                {meta.requireReason && (
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
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                disabled={isLoading}
                className="text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isLoading || !canSubmit}
                onClick={() => onConfirm(meta.requireReason ? reason : undefined)}
                className={`${meta.buttonBase} ${meta.buttonHover} ${meta.buttonText} shadow-lg shadow-slate-900/10 transition-all disabled:opacity-50 disabled:shadow-none`}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <meta.confirmIcon className="mr-2 h-4 w-4" />
                )}
                {meta.confirmLabel}
              </Button>
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
const STATUS_STYLES: Record<string, { border: string; bg: string; badge: string }> = {
  PENDING: {
    border: "border-amber-200",
    bg: "bg-amber-50/40",
    badge: "bg-amber-100 text-amber-700 ring-amber-200",
  },
  APPROVED: {
    border: "border-emerald-200",
    bg: "bg-emerald-50/30",
    badge: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  },
  REJECTED: {
    border: "border-rose-200",
    bg: "bg-rose-50/30",
    badge: "bg-rose-100 text-rose-700 ring-rose-200",
  },
};

function getStatusStyle(status?: string) {
  return STATUS_STYLES[status ?? ""] ?? STATUS_STYLES.PENDING;
}

/* ═════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═════════════════════════════════════════════════════════════════ */
export function TeamsTab({ tournament, isOwner }: { tournament: Tournament; isOwner: boolean }) {
  const { data: teams, isLoading } = useTeams(tournament.id);
  const approveTeam = useApproveTeam(tournament.id);
  const rejectTeam = useRejectTeam(tournament.id);
  const approveTeams = useMarkTeamsApproved(tournament.id);

  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: "approve",
    team: null,
  });

  const openModal = useCallback((type: ModalType, team: Team) => {
    setModal({ isOpen: true, type, team });
  }, []);

  const closeModal = useCallback(() => {
    if (approveTeam.isPending || rejectTeam.isPending) return;
    setModal((m) => ({ ...m, isOpen: false }));
    setTimeout(() => {
      setModal({ isOpen: false, type: "approve", team: null });
      approveTeam.reset();
      rejectTeam.reset();
    }, 300);
  }, [approveTeam, rejectTeam]);

  const handleConfirm = useCallback(
    (reason?: string) => {
      if (!modal.team) return;
      if (modal.type === "approve") {
        approveTeam.mutate(modal.team.id, { onSuccess: closeModal });
      } else {
        if (!reason?.trim()) return;
        rejectTeam.mutate(
          { teamId: modal.team.id, reason: reason.trim() },
          { onSuccess: closeModal }
        );
      }
    },
    [modal, approveTeam, rejectTeam, closeModal]
  );

  const pendingCount = teams?.filter((t) => t.status === "PENDING").length ?? 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TournamentCardSkeleton />
        <TournamentCardSkeleton />
        <TournamentCardSkeleton />
        <TournamentCardSkeleton />
      </div>
    );
  }

  if (!teams?.length) {
    return (
      <EmptyState
        icon={Users2}
        title="No franchises registered yet"
        description="Once franchise owners register their teams, they'll show up here for your approval."
      />
    );
  }

  return (
    <div className="relative">
      {/* Bulk action bar */}
      <AnimatePresence>
        {isOwner && pendingCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-3.5 shadow-sm shadow-amber-900/5"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <Clock className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-amber-900">
                {pendingCount} franchise{pendingCount > 1 ? "s" : ""} awaiting approval
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="!w-auto bg-white text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50"
              isLoading={approveTeams.isPending}
              onClick={() => approveTeams.mutate()}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              Approve all pending
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AnimatePresence mode="popLayout">
          {teams.map((team, i) => {
            const style = getStatusStyle(team.status);
            const meta = TEAM_STATUS_META[team.status];
            const isPending = team.status === "PENDING";

            return (
              <motion.div
                key={team.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.35, delay: i * 0.04, layout: { duration: 0.3 } }}
                className={`group relative overflow-hidden rounded-2xl border bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${style.border} ${style.bg}`}
              >
                {/* Status accent line */}
                <div
                  className={`absolute left-0 top-0 h-full w-1 ${
                    team.status === "PENDING"
                      ? "bg-amber-400"
                      : team.status === "APPROVED"
                        ? "bg-emerald-400"
                        : "bg-rose-400"
                  }`}
                />

                <div className="flex items-start gap-3.5 pl-2">
                  <TeamAvatar
                    name={team.name}
                    shortCode={team.shortCode}
                    image={team.logo}
                    brandColor={team.brandColor}
                    sizeClass="h-11 w-11 text-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-bold text-slate-900">{team.name}</p>
                      <Badge className={`${style.badge} text-xs`}>
                        {meta?.label ?? team.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <Crown className="h-3 w-3 text-amber-500" />
                        {team.ownerName}
                      </span>
                      {team.city ? <span className="ml-2 text-slate-400">· {team.city}</span> : null}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 font-medium text-slate-700">
                        <Shield className="h-3 w-3 text-slate-400" />
                        {formatCurrency(team.purse, tournament.currency)}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-400">
                        <Clock className="h-3 w-3" />
                        Joined {format(new Date(team.createdAt), "d MMM yyyy")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Organizer Actions */}
                <AnimatePresence>
                  {isOwner && isPending && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="mt-3 overflow-hidden pl-2"
                    >
                      <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-emerald-200 bg-emerald-50/50 text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800"
                          onClick={() => openModal("approve", team as Team)}
                        >
                          <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-rose-200 bg-rose-50/50 text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100 hover:text-rose-800"
                          onClick={() => openModal("reject", team as Team)}
                        >
                          <Ban className="mr-1.5 h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        state={modal}
        onClose={closeModal}
        onConfirm={handleConfirm}
        isLoading={approveTeam.isPending || rejectTeam.isPending}
        error={modal.type === "approve" ? approveTeam.error : rejectTeam.error}
      />
    </div>
  );
}