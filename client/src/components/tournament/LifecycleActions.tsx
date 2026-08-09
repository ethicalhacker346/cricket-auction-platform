import { Ban, CheckCircle2, Gavel, Users, UserPlus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { 
  useOpenPlayerRegistration, 
  useOpenTeamRegistration, 
  useMarkTeamsApproved,
  useCompleteTournament,
  useCancelTournament 
} from "@/hooks/useTournaments";
import { TOURNAMENT_TRANSITIONS, TOURNAMENT_STATUS, STATUS_META } from "@/lib/constants/tournament";
import type { Tournament, TournamentStatus } from "@/types/tournament";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"; // Assuming you have a reusable confirm dialog

// Only these five transitions are surfaced as manual organizer actions here.
// Auction scheduling/starting/completing is driven by the Auction module's
// own flow (CreateAuctionPage, live room, etc.) — not by a generic button
// on this bar — so AUCTION_SCHEDULED / AUCTION_RUNNING / AUCTION_COMPLETED
// are intentionally absent from this map.
const ACTION_META: Partial<
  Record<TournamentStatus, {
    label: string;
    icon: React.ComponentType<any>;
    variant: "default" | "secondary" | "outline" | "destructive";
    hook: (id: string) => any; // Mutation hook
    needsConfirmation?: boolean;
    confirmTitle?: string;
    confirmDescription?: string;
  }>
> = {
  [TOURNAMENT_STATUS.PLAYER_REGISTRATION_OPEN]: {
    label: "Open Player Registration",
    icon: UserPlus,
    variant: "default",
    hook: useOpenPlayerRegistration,
  },
  [TOURNAMENT_STATUS.TEAM_REGISTRATION_OPEN]: {
    label: "Open Team Registration",
    icon: Users,
    variant: "default",
    hook: useOpenTeamRegistration,
  },
  [TOURNAMENT_STATUS.TEAMS_APPROVED]: {
    label: "Mark Teams Approved",
    icon: CheckCircle2,
    variant: "default",
    hook: useMarkTeamsApproved,
    needsConfirmation: true,
    confirmTitle: "Approve Registered Teams?",
    confirmDescription:
      "Are you sure you want to approve/reject all the registered teams? This closes team registration and moves the tournament to the next stage — it cannot be undone.",
  },
  [TOURNAMENT_STATUS.TOURNAMENT_COMPLETED]: {
    label: "Mark Tournament Completed",
    icon: Trophy,
    variant: "default",
    hook: useCompleteTournament,
  },
  [TOURNAMENT_STATUS.CANCELLED]: {
    label: "Cancel Tournament",
    icon: Ban,
    variant: "destructive",
    hook: useCancelTournament,
    needsConfirmation: true,
    confirmTitle: "Cancel Tournament?",
    confirmDescription: "This action cannot be undone. All registrations and progress will be lost.",
  },
};

export function LifecycleActions({ tournament }: { tournament: Tournament }) {
  const [pendingAction, setPendingAction] = useState<TournamentStatus | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionToConfirm, setActionToConfirm] = useState<TournamentStatus | null>(null);

  const options = TOURNAMENT_TRANSITIONS[tournament.status] || [];

  // Instantiate all possible hooks (React rules — hooks can't be conditional)
  const openPlayerReg = useOpenPlayerRegistration(tournament.id);
  const openTeamReg = useOpenTeamRegistration(tournament.id);
  const markTeamsApproved = useMarkTeamsApproved(tournament.id);
  const completeTournament = useCompleteTournament(tournament.id);
  const cancelTournament = useCancelTournament(tournament.id);

  const getMutation = (status: TournamentStatus) => {
    switch (status) {
      case TOURNAMENT_STATUS.PLAYER_REGISTRATION_OPEN: return openPlayerReg;
      case TOURNAMENT_STATUS.TEAM_REGISTRATION_OPEN: return openTeamReg;
      case TOURNAMENT_STATUS.TEAMS_APPROVED: return markTeamsApproved;
      case TOURNAMENT_STATUS.TOURNAMENT_COMPLETED: return completeTournament;
      case TOURNAMENT_STATUS.CANCELLED: return cancelTournament;
      default: return null;
    }
  };

  const handleAction = (status: TournamentStatus) => {
    const meta = ACTION_META[status];
    if (!meta) return;

    if (meta.needsConfirmation) {
      setActionToConfirm(status);
      setShowConfirm(true);
      return;
    }

    const mutation = getMutation(status);
    if (mutation) {
      setPendingAction(status);
      mutation.mutate(undefined, {
        onSettled: () => setPendingAction(null),
      });
    }
  };

  const confirmAction = () => {
    if (!actionToConfirm) return;
    const mutation = getMutation(actionToConfirm);
    if (mutation) {
      mutation.mutate(undefined, {
        onSettled: () => {
          setShowConfirm(false);
          setActionToConfirm(null);
        },
      });
    }
  };

  if (!options.length) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-slate-400">
        <Gavel className="h-4 w-4" />
        Tournament lifecycle is complete.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-wrap gap-2.5">
        {options.map((nextStatus) => {
          const meta = ACTION_META[nextStatus];
          if (!meta) return null;

          const Icon = meta.icon;
          const mutation = getMutation(nextStatus);
          const isLoading = mutation?.isPending || pendingAction === nextStatus;

          return (
            <Button
              key={nextStatus}
              variant={meta.variant}
              size="sm"
              className="!w-auto"
              isLoading={isLoading}
              onClick={() => handleAction(nextStatus)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {meta.label}
            </Button>
          );
        })}
      </div>

      <ConfirmDialog
        open={showConfirm}
        onOpenChange={setShowConfirm}
        title={ACTION_META[actionToConfirm!]?.confirmTitle || "Confirm Action"}
        description={ACTION_META[actionToConfirm!]?.confirmDescription || "Are you sure?"}
        onConfirm={confirmAction}
        confirmVariant={ACTION_META[actionToConfirm!]?.variant === "destructive" ? "destructive" : "default"}
      />
    </>
  );
}