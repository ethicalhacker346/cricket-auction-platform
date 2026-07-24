import { Link } from "react-router-dom";
import { Edit3, Trash2, Users } from "lucide-react";

import type { AuctionRound } from "@/features/auction/types/index.types";
import { RoundStatusBadge, RoundTypeBadge } from "./Badges";

type RoundCardProps = {
  round: AuctionRound;
  editUrl: string;
  canManage: boolean;
  onDelete: (id: string) => void;
  onManagePlayers?: (roundId: string) => void;
};

function RoundCard({
  round,
  editUrl,
  canManage,
  onDelete,
  onManagePlayers,
}: RoundCardProps) {
  const isLocked =
    round.status === "active" ||
    round.status === "completed";

  const canEdit = canManage && !isLocked;
  const canDelete = canManage && !isLocked;

  return (
    <div className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/20">
      <div className="flex items-center gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-sm font-bold text-slate-300 ring-1 ring-white/10">
          #{round.order}
        </span>

        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-white">
              {round.name}
            </p>

            <RoundTypeBadge type={round.type} />
          </div>

          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Users className="h-3.5 w-3.5" />
            {round.playerIds?.length ?? 0} players
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <RoundStatusBadge status={round.status} />

        {canEdit ? (
          <Link
            to={editUrl}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 text-slate-300 ring-1 ring-white/10 transition hover:bg-white/10"
            aria-label="Edit round"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span
            className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-lg bg-white/5 text-slate-600 ring-1 ring-white/10 opacity-40"
            title={
              isLocked
                ? "Round is locked"
                : "Organizer only"
            }
          >
            <Edit3 className="h-3.5 w-3.5" />
          </span>
        )}

        <button
          onClick={() => onDelete(round.id)}
          disabled={!canDelete}
          title={
            isLocked
              ? "Round is locked"
              : canManage
              ? "Delete round"
              : "Organizer only"
          }
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

type RoundListProps = {
  rounds: AuctionRound[];
  canManage: boolean;
  editRoute: (roundId: string) => string;
  onDelete: (id: string) => void;
  onManagePlayers?: (roundId: string) => void;
};

export function RoundList({
  rounds,
  canManage,
  editRoute,
  onDelete,
  onManagePlayers,
}: RoundListProps) {
  if (rounds.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-10 text-center">
        <p className="text-sm text-slate-500">
          No rounds configured yet.
        </p>

        <p className="mt-1 text-xs text-slate-600">
          Create a round to begin adding players.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rounds.map((round) => (
        <RoundCard
          key={round.id}
          round={round}
          canManage={canManage}
          editUrl={editRoute(round.id)}
          onDelete={onDelete}
          onManagePlayers={onManagePlayers}
        />
      ))}
    </div>
  );
}