
import { Link } from "react-router-dom";
import { Edit3, Trash2, Users, Lock } from "lucide-react";

import type { AuctionRound } from "@/features/auction/types/index.types";
import { RoundStatusBadge, RoundTypeBadge, RoundCategoryBadge } from "./Badges";

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

  // The unsold round is engine-managed: AuctionRound.js rejects manual
  // playerIds edits on it once it exists (enforceUnsoldRoundPlayerIds), since
  // the auction engine repopulates it automatically from unsold lots.
  // Round metadata (name/order) can still be edited, but player membership can't.
  const isAutoManaged = round.type === "unsold";

  const canEdit = canManage && !isLocked;
  const canDelete = canManage && !isLocked;
  const canManagePlayers =
    canManage &&
    !isLocked &&
    !isAutoManaged &&
    !!onManagePlayers;

  return (
    <div
      className="
        group
        flex
        min-w-0
        flex-col
        gap-4
        rounded-2xl
        border
        border-white/10
        bg-white/[0.03]
        p-4
        transition
        hover:border-white/20
        sm:flex-row
        sm:items-center
        sm:justify-between
      "
    >
      {/* ─────────────────────────────────────────────
          Round information
          ───────────────────────────────────────────── */}
      <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
        <span
          className="
            flex
            h-11
            w-11
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-white/5
            text-sm
            font-bold
            text-slate-300
            ring-1
            ring-white/10
          "
        >
          #{round.order}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <p
              className="
                min-w-0
                max-w-full
                break-words
                font-semibold
                leading-snug
                text-white
              "
            >
              {round.name}
            </p>

            {/* Type: structural/engine concept (normal vs unsold) */}
            <RoundTypeBadge type={round.type} />

            {/* Category: which players this round is for */}
            {round.category ? (
              <RoundCategoryBadge category={round.category} />
            ) : null}

            {isAutoManaged && (
              <span
                className="
                  inline-flex
                  max-w-full
                  shrink-0
                  items-center
                  gap-1
                  rounded-full
                  bg-white/5
                  px-2
                  py-0.5
                  text-[10px]
                  font-medium
                  text-slate-500
                  ring-1
                  ring-white/10
                "
                title="Player list is managed automatically by the auction engine"
              >
                <Lock className="h-2.5 w-2.5 shrink-0" />
                <span>Auto-managed</span>
              </span>
            )}
          </div>

          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Users className="h-3.5 w-3.5 shrink-0" />
            <span>{round.playerIds?.length ?? 0} players</span>
          </p>
        </div>
      </div>

      {/* ─────────────────────────────────────────────
          Status + actions

          Mobile:
            full width + right aligned

          Desktop:
            natural width + horizontal alignment
          ───────────────────────────────────────────── */}
      <div
        className="
          flex
          w-full
          min-w-0
          shrink-0
          items-center
          justify-end
          gap-2
          sm:w-auto
        "
      >
        <RoundStatusBadge status={round.status} />

        {/* Manage players intentionally disabled/hidden for now.
        {onManagePlayers && (
          <button
            onClick={() =>
              canManagePlayers && onManagePlayers(round.id)
            }
            disabled={!canManagePlayers}
            title={
              isAutoManaged
                ? "Players for the unsold round are added automatically"
                : isLocked
                ? "Round is locked"
                : canManage
                ? "Manage players"
                : "Organizer only"
            }
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-lg
              bg-white/5
              text-slate-300
              ring-1
              ring-white/10
              transition
              hover:bg-white/10
              disabled:cursor-not-allowed
              disabled:opacity-30
            "
          >
            <Users className="h-3.5 w-3.5" />
          </button>
        )}
        */}

        {canEdit ? (
          <Link
            to={editUrl}
            className="
              flex
              h-8
              w-8
              shrink-0
              items-center
              justify-center
              rounded-lg
              bg-white/5
              text-slate-300
              ring-1
              ring-white/10
              transition
              hover:bg-white/10
            "
            aria-label="Edit round"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Link>
        ) : (
          <span
            className="
              flex
              h-8
              w-8
              shrink-0
              cursor-not-allowed
              items-center
              justify-center
              rounded-lg
              bg-white/5
              text-slate-600
              ring-1
              ring-white/10
              opacity-40
            "
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
          type="button"
          onClick={() => onDelete(round.id)}
          disabled={!canDelete}
          title={
            isLocked
              ? "Round is locked"
              : canManage
              ? "Delete round"
              : "Organizer only"
          }
          className="
            flex
            h-8
            w-8
            shrink-0
            items-center
            justify-center
            rounded-lg
            bg-rose-500/10
            text-rose-400
            ring-1
            ring-rose-500/20
            transition
            hover:bg-rose-500/20
            disabled:cursor-not-allowed
            disabled:opacity-30
          "
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
    <div className="min-w-0 space-y-3">
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
