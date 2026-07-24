import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, GripVertical, Loader2, Plus, Save, ShieldAlert, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  useAuth,
  useAuctionRounds,
  useAuctionPermissions,
} from "@/features/auction/hooks/index.hook";
import { playerApi } from "@/features/auction/api/index.api";
import type { Player, RoundType } from "@/features/auction/types/index.types";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";
import { ROLE_ICONS } from "@/features/auction/constants/index.constants";
import { useAuctionContext } from "../hooks/useAuctionContext";
import { resolveAuctionRoute } from "../routes/auction.navigation";
import { AuctionSegments } from "../routes/auction.routes";

const TYPES: RoundType[] = ["marquee", "capped", "uncapped", "overseas", "accelerated"];

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
  const [type, setType] = useState<RoundType>("capped");
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
      setType(round.type);
      setPlayerIds(round.playerIds ?? []);
    }
  }, [round]);

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

  const pool = players.filter(
    (p) => !playerIds.includes(p.id) && p.name.toLowerCase().includes(search.toLowerCase())
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
      await actions.update(round.id, { name, type, playerIds });
      navigate(roundsRoute);
    } catch (e: any) {
      setSaveError(e.message || "Failed to save round");
      setSaving(false);
    }
  }

  const isLocked = round.status === "active" || round.status === "completed";

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
            value={type}
            onChange={(e) => setType(e.target.value as RoundType)}
            disabled={isLocked}
            className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50 disabled:opacity-50"
          >
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Assigned players */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="mb-3 text-sm font-semibold text-slate-300">
            Player Order ({assigned.length})
          </p>
          <p className="mb-3 text-[11px] text-slate-500">
            Drag cards to reorder the sequence players will be auctioned in.
          </p>
          <div className="space-y-2">
            {assigned.map((p, i) => (
              <div
                key={p.id}
                draggable={!isLocked}
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
                  disabled={isLocked}
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
            placeholder="Search players…"
            className="mb-3 w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50"
          />
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {playersLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              </div>
            ) : pool.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-600">No matching players</p>
            ) : (
              pool.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-lg bg-white/[0.02] px-3 py-2"
                >
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
                    onClick={() => setPlayerIds((prev) => [...prev, p.id])}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300 transition hover:bg-amber-400/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
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