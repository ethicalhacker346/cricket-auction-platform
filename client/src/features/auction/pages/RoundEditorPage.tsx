import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GripVertical, Loader2, Lock, Plus, Save, ShieldAlert, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  useAuth,
  useAuctionRounds,
  useAuctionPermissions,
} from "@/features/auction/hooks/index.hook";
import { playerApi } from "@/features/auction/api/index.api";
import type { Player, AuctionRound, AuctionRoundCategory } from "@/features/auction/types/index.types";
import { RoundTypeBadge } from "@/features/auction/components/Badges";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { ROLE_ICONS } from "@/features/auction/constants/index.constants";
import { useAuctionContext } from "../hooks/useAuctionContext";
import { resolveAuctionRoute } from "../routes/auction.navigation";
import { AuctionSegments } from "../routes/auction.routes";

// ============================================================================
// Round CATEGORY — who a round is for. Editable here (organizer content).
//
// Round TYPE ("normal" | "unsold") is intentionally NOT editable in this
// form. It's a structural/engine concept (AuctionRound.js / ROUND_TYPE):
// the unsold round is auto-created by the auction engine, must always be
// last, and rejects manual playerIds edits once it exists
// (enforceUnsoldRoundPlayerIds). Flipping an existing round's type here
// would bypass those invariants, so it's shown as a read-only badge instead.
// ============================================================================
const CATEGORIES: AuctionRoundCategory[] = [
  "BATSMAN",
  "BOWLER",
  "ALL_ROUNDER",
  "WICKET_KEEPER",
  "CAPPED",
  "UNCAPPED",
  "OVERSEAS",
  "MARQUEE",
  "CUSTOM",
];

const CATEGORY_LABEL: Record<AuctionRoundCategory, string> = {
  BATSMAN: "Batters",
  BOWLER: "Bowlers",
  ALL_ROUNDER: "All-Rounders",
  WICKET_KEEPER: "Keepers",
  CAPPED: "Capped",
  UNCAPPED: "Uncapped",
  OVERSEAS: "Overseas",
  MARQUEE: "Marquee",
  CUSTOM: "Custom",
};

export default function RoundEditorPage() {
  const { roundId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, hasHydrated } = useAuth();
  const { tournamentId, auctionId } = useAuctionContext();

  const roundsRoute = resolveAuctionRoute(
    AuctionSegments.rounds,
    tournamentId,
    auctionId,
  );

  const { rounds, actions, loading: roundsLoading } = useAuctionRounds(auctionId);
  const permissions = useAuctionPermissions(auctionId);

  const [players, setPlayers] = useState<Player[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AuctionRoundCategory | string>("CUSTOM");
  const [playerIds, setPlayerIds] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const round = rounds.find((r) => r.id === roundId);

  // Load players from real backend
  useEffect(() => {
    if (!tournamentId) {
      setPlayers([]);
      setPlayersLoading(false);
      return;
    }
    let cancelled = false;
    const loadPlayers = async () => {
      try {
        setPlayersLoading(true);
        const list = await playerApi.listPlayers(tournamentId);
        if (!cancelled) setPlayers(list);
      } catch (e: any) {
        if (!cancelled) setSaveError(e.message || "Failed to load players");
      } finally {
        if (!cancelled) setPlayersLoading(false);
      }
    };
    loadPlayers();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  // Seed form from round data
  useEffect(() => {
    if (round) {
      setName(round.name);
      setCategory(round.category ?? "CUSTOM");
      setPlayerIds(round.playerIds ?? []);
    }
  }, [round]);

  // ─────────────────────────────────────────────────────────────────────────
  // DEEP FIX: Player → Round mapping that respects BOTH server state and
  // local unsaved edits. This is the single source of truth for the pool.
  // ─────────────────────────────────────────────────────────────────────────
  const playerToRoundMap = useMemo(() => {
    const map = new Map<string, AuctionRound>();

    // 1. OTHER rounds (server truth — never edited on this page)
    for (const r of rounds) {
      if (r.id === roundId) continue;
      for (const pid of r.playerIds) {
        if (!map.has(pid)) map.set(pid, r);
      }
    }

    // 2. CURRENT round (local `playerIds` is the source of truth here).
    //    This means dragging a player OUT of the left panel instantly frees
    //    them in the pool without waiting for a server save.
    if (round) {
      for (const pid of playerIds) {
        map.set(pid, round);
      }
    }

    return map;
  }, [rounds, roundId, round, playerIds]);

  // Guards
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
          Sign in to manage auction rounds.
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

  if (!permissions.ownsAuction && !permissions.canManageAuction && !permissions.canManageRounds) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-center gap-4 py-32 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Organizer Access Required</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Only organizers can edit auction rounds.
        </p>
        <Link
          to={resolveAuctionRoute(AuctionSegments.live, tournamentId, auctionId)}
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
        >
          Go to Live Auction
        </Link>
      </div>
    );
  }

  if (roundsLoading) {
    return (
      <div className="mx-auto flex max-w-5xl items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!round) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <p className="text-sm text-slate-500">Round not found.</p>
        <button
          onClick={() => navigate(roundsRoute)}
          className="text-sm text-amber-400 underline transition hover:text-amber-300"
        >
          Back to rounds
        </button>
      </div>
    );
  }

  const assigned = playerIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => !!p);

  // ─────────────────────────────────────────────────────────────────────────
  // DEEP FIX: Pool now shows ALL matching players. Taken ones are disabled
  // and annotated with their round name instead of being silently hidden.
  // ─────────────────────────────────────────────────────────────────────────
  const pool = players.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase())
  );

  function reorder(from: number, to: number) {
    setPlayerIds((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(from, 1);
      copy.splice(to, 0, moved);
      return copy;
    });
  }

  async function handleSave() {
    if (!round) return;
    setSaving(true);
    setSaveError(null);
    try {
      // playerIds on the "unsold" round are engine-managed — AuctionRound.js
      // rejects manual edits to it once the round exists, so we never send
      // it back in that case, even though local `playerIds` state mirrors
      // it for display.
      await actions.update(round.id, {
        name,
        category,
        ...(isAutoManaged ? {} : { playerIds }),
      });
      navigate(roundsRoute);
    } catch (e: any) {
      setSaveError(e.message || "Failed to save round");
      setSaving(false);
    }
  }

  const isLocked = round.status === "active" || round.status === "completed";
  // Structural constraint from AuctionRound.js enforceUnsoldRoundPlayerIds:
  // once an "unsold" round exists, its playerIds can only be changed by the
  // auction engine (as lots go unsold), never manually.
  const isAutoManaged = round.type === "unsold";
  const playersEditable = !isLocked && !isAutoManaged;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-5xl space-y-6"
    >
      <button
        onClick={() => navigate(roundsRoute)}
        className="flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to rounds
      </button>

      {isLocked && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          This round is {round.status} — editing is limited to avoid disrupting the live auction.
        </div>
      )}

      {isAutoManaged && (
        <div className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs text-slate-400">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <span>
            This is the Unsold Pool round. Its player list is populated automatically by the
            auction engine whenever a lot goes unsold, so it can&apos;t be edited manually here.
            Name and category can still be updated.
          </span>
        </div>
      )}

      {saveError && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">
          {saveError}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="mb-4 text-sm font-semibold text-slate-300">Round Details</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isLocked}
            placeholder="Round name"
            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50 disabled:opacity-50 sm:col-span-2"
          />

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AuctionRoundCategory)}
            disabled={isLocked}
            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50 disabled:opacity-50"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
            {/* Fallback keeps a legacy/unknown backend category selectable
                instead of silently snapping to the first option. Category is
                free-text server-side (AuctionRound.js), not an enum. */}
            {!CATEGORIES.includes(category as AuctionRoundCategory) && (
              <option value={category}>{category}</option>
            )}
          </select>
        </div>

        {/* Type is structural, not organizer-editable — shown for context only */}
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-400">Type:</span>
          <RoundTypeBadge type={round.type} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Assigned players */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">
            Player Order ({assigned.length})
          </p>
          <p className="mb-3 text-[11px] text-slate-500">
            {isAutoManaged
              ? "Players are added here automatically as lots go unsold."
              : "Drag cards to reorder the sequence players will be auctioned in."}
          </p>
          <div className="space-y-2">
            {assigned.map((p, i) => (
              <div
                key={p.id}
                draggable={playersEditable}
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragIndex !== null && dragIndex !== i) reorder(dragIndex, i);
                  setDragIndex(null);
                }}
                className="flex cursor-grab items-center gap-2.5 rounded-lg bg-white/[0.02] px-3 py-2 active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4 shrink-0 text-slate-600" />
                <span className="w-5 shrink-0 text-xs font-bold text-slate-500">{i + 1}</span>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[10px] font-bold text-white">
                  {initials(p.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-200">{p.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {ROLE_ICONS[p.role]} {p.role} · {formatLakhs(p.basePrice)}
                  </p>
                </div>
                <button
                  onClick={() => setPlayerIds((prev) => prev.filter((id) => id !== p.id))}
                  disabled={!playersEditable}
                  className="text-slate-600 transition hover:text-rose-400 disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {assigned.length === 0 && (
              <p className="py-6 text-center text-xs text-slate-600">
                No players in this round yet
              </p>
            )}
          </div>
        </div>

        {/* Player pool */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">Player Pool</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={!playersEditable}
            placeholder="Search players…"
            className="mb-3 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50 disabled:opacity-50"
          />
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {playersLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              </div>
            ) : pool.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-600">No matching players</p>
            ) : (
              pool.map((p) => {
                const assignedRound = playerToRoundMap.get(p.id);
                const isInCurrentRound = assignedRound?.id === round?.id;
                const isTaken = !!assignedRound;

                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 ${
                      isTaken ? "bg-white/[0.01]" : "bg-white/[0.02]"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${
                        isTaken ? "bg-slate-800/50 text-slate-600" : "bg-slate-800 text-white"
                      }`}
                    >
                      {initials(p.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-xs font-medium ${
                          isTaken ? "text-slate-500" : "text-slate-200"
                        }`}
                      >
                        {p.name}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {ROLE_ICONS[p.role]} {p.role} · {formatLakhs(p.basePrice)}
                        {isInCurrentRound && (
                          <span className="ml-1.5 text-amber-400/80">· Already in this round</span>
                        )}
                        {assignedRound && !isInCurrentRound && (
                          <span className="ml-1.5 text-sky-400/80">· In: {assignedRound.name}</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => setPlayerIds((prev) => [...prev, p.id])}
                      disabled={!playersEditable || isTaken}
                      title={
                        isTaken
                          ? isInCurrentRound
                            ? "Already in this round"
                            : `Assigned to ${assignedRound.name}`
                          : "Add to round"
                      }
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-30 ${
                        isTaken
                          ? "bg-white/5 text-slate-600"
                          : "bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
                      }`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving || isLocked}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110 disabled:opacity-50"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saving ? "Saving…" : "Save Round"}
      </button>
    </motion.div>
  );
}