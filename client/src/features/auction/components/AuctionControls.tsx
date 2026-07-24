import { CheckCircle2, Gavel, Hammer, Pause, Play, PowerOff, XCircle, Loader2 } from "lucide-react";
import { useAuctionPermissions, useLiveAuction } from "@/features/auction/hooks/index.hook";
import { cn } from "@/utils/cn";

function ControlButton({
  onClick,
  disabled,
  icon: Icon,
  label,
  variant = "default",
  loading = false,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ElementType;
  label: string;
  variant?: "default" | "primary" | "danger" | "success";
  loading?: boolean;
}) {
  const variants: Record<string, string> = {
    default: "bg-white/5 text-slate-200 ring-1 ring-white/10 hover:bg-white/10",
    primary: "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/25",
    danger: "bg-rose-500/90 text-white hover:bg-rose-500 shadow-lg shadow-rose-500/20",
    success: "bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-lg shadow-amber-400/20",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-30",
        variants[variant]
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      {label}
    </button>
  );
}

export function AuctionControls() {
  const { actions, currentPlayerId } = useLiveAuction();
  const permissions = useAuctionPermissions();

  if (permissions.loading) {
    return (
      <div className="flex h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] p-2.5 text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading permissions...
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
      <ControlButton icon={Play} label="Start Auction" onClick={actions.start} disabled={!permissions.canStart} variant="primary" />
      <ControlButton icon={Pause} label="Pause" onClick={actions.pause} disabled={!permissions.canPause} />
      <ControlButton icon={Play} label="Resume" onClick={actions.resume} disabled={!permissions.canResume} variant="primary" />
      <ControlButton
        icon={Gavel}
        label="Open Next Lot"
        onClick={actions.openNextLot}
        disabled={!permissions.canOpenLot}
        variant="success"
      />
      <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
      <ControlButton
        icon={Hammer}
        label="Force Sold"
        onClick={actions.forceSold}
        disabled={!permissions.canMarkSold || !currentPlayerId}
      />
      <ControlButton
        icon={XCircle}
        label="Force Unsold"
        onClick={actions.forceUnsold}
        disabled={!permissions.canMarkUnsold || !currentPlayerId}
      />
      <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
      <ControlButton icon={CheckCircle2} label="Complete" onClick={actions.complete} disabled={!permissions.canComplete} variant="danger" />
      {!permissions.canStart && !permissions.canPause && !permissions.canResume && !permissions.canComplete && !permissions.loading && (
        <span className="flex items-center gap-1 pl-1 text-xs text-slate-500">
          <PowerOff className="h-3.5 w-3.5" /> Switch to Organizer view to control the auction
        </span>
      )}
    </div>
  );
}