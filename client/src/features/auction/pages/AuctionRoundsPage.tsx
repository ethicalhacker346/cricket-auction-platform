import { useState } from "react";
import { Info, ListOrdered, Loader2, Plus, ShieldAlert, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  useAuth,
  useAuctionRounds,
  useAuctionPermissions,
  useLiveAuction,
} from "@/features/auction/hooks/index.hook";
import { RoundList } from "@/features/auction/components/RoundList";
import type { AuctionRoundCategory } from "@/features/auction/types/index.types";
import { resolveAuctionRoute } from "../routes/auction.navigation";
import { AuctionSegments } from "../routes/auction.routes";
import { useAuctionContext } from "../hooks/useAuctionContext";
import { PlayerPoolDrawer } from "../components/player-pool/PlayerPoolDrawer";

// ============================================================================
// Round CATEGORY — which players a round is for (Batters, Overseas, Marquee…).
// This is organizer-authored content, distinct from round TYPE.
//
// Round TYPE is intentionally NOT offered as a create-form choice here: the
// backend only recognizes "normal" | "unsold" (AuctionRound.js / ROUND_TYPE),
// and the "unsold" round is engine-managed — it is auto-created by the
// auction engine when lots go unsold, is always ordered last, and rejects
// manual playerIds edits (see AuctionRound.js enforceUnsoldRoundPlayerIds /
// enforceUnsoldRoundIsLast). Every round an organizer creates by hand here is
// therefore always type "normal"; there's nothing to pick.
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

export default function AuctionRoundsPage() {
  const { isAuthenticated, hasHydrated } = useAuth();
  const { tournamentId, auctionId } = useAuctionContext();
  const { auction } = useLiveAuction();
  const permissions = useAuctionPermissions();

  const storeAuctionId = auction?.id;
  const { rounds, actions, loading } = useAuctionRounds(storeAuctionId);

  const [name, setName] = useState("");
  const [category, setCategory] = useState<AuctionRoundCategory>("CUSTOM");
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Player Pool Drawer State ──────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeRoundId, setActiveRoundId] = useState<string | undefined>(undefined);

  function openPlayerPool(roundId?: string) {
    setActiveRoundId(roundId);
    setDrawerOpen(true);
  }

  // ── Handlers ─────────────────────────────────────────────────────────
  async function handleAdd() {
    if (!name.trim()) return;
    if (!storeAuctionId) {
      setCreateError("No auction selected");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const nextOrder = rounds.reduce((max, r) => Math.max(max, r.order), 0) + 1;
      await actions.add({
        name: name.trim(),
        type: "normal",
        category,
        order: nextOrder,
        status: "pending",
        playerIds: [],
      });
      setName("");
      setCategory("CUSTOM");
      setShowForm(false);
    } catch (e: any) {
      setCreateError(e.message || "Failed to create round");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(roundId: string) {
    setDeleteError(null);
    try {
      await actions.remove(roundId);
    } catch (e: any) {
      setDeleteError(e.message || "Failed to delete round");
    }
  }

  // ── Guards (unchanged) ────────────────────────────────────────────────
  if (!hasHydrated || permissions.loading) {
    return (
      <div className="mx-auto flex max-w-4xl items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 py-32 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Authentication Required</h2>
        <p className="max-w-sm text-sm text-slate-400">Sign in to manage auction rounds.</p>
        <Link
          to="/login"
          className="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (!permissions.ownsAuction && !permissions.canManageAuction) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 py-32 text-center">
        <ShieldAlert className="h-12 w-12 text-rose-400" />
        <h2 className="text-lg font-bold text-white">Organizer Access Required</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Only organizers can create and manage auction rounds.
        </p>
        <Link
          to="/live"
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
        >
          Go to Live Auction
        </Link>
      </div>
    );
  }

  if (!storeAuctionId) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col items-center justify-center gap-4 py-32 text-center">
        <ListOrdered className="h-12 w-12 text-slate-500" />
        <h2 className="text-lg font-bold text-white">No Auction Selected</h2>
        <p className="max-w-sm text-sm text-slate-400">
          Create or select an auction from the dashboard to manage rounds.
        </p>
        <Link
          to="/create"
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20"
        >
          Create Auction
        </Link>
      </div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-4xl space-y-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-white">
              <ListOrdered className="h-5 w-5 text-amber-300" /> Round Management
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Organize the sequence of sets that will be presented during the live auction.
            </p>
          </div>
          <div className="flex items-center gap-2">
           {/* <button
              onClick={() => openPlayerPool()}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/[0.06]"
            >
              <Users className="h-4 w-4 text-amber-400" /> Manage Players
            </button> */}
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 transition hover:brightness-110"
            >
              <Plus className="h-4 w-4" /> New Round
            </button>
          </div>
        </div>

        {createError && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">
            {createError}
          </div>
        )}

        {deleteError && (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">
            {deleteError}
          </div>
        )}

        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Round name e.g. Marquee Set"
                className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50 sm:col-span-2"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AuctionRoundCategory)}
                className="rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none transition focus:border-amber-400/50"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>

            <p className="mt-2.5 flex items-start gap-1.5 text-[11px] text-slate-500">
              <Info className="mt-0.5 h-3 w-3 shrink-0" />
              New rounds are created as standard rounds. The Unsold Pool round is
              created automatically by the auction engine when lots go unsold —
              it doesn&apos;t need to be created here.
            </p>

            <button
              onClick={handleAdd}
              disabled={creating || !name.trim()}
              className="mt-3 flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create Round"}
            </button>
          </motion.div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : rounds.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
            No rounds configured yet. Create your first round to get started.
          </p>
        ) : (
          <RoundList
            rounds={rounds}
            canManage={permissions.ownsAuction || permissions.canManageAuction}
            editRoute={(roundId) =>
              resolveAuctionRoute(AuctionSegments.round, tournamentId, auctionId, { roundId })
            }
            onDelete={handleDelete}
            onManagePlayers={openPlayerPool}
          />
        )}
      </motion.div>

      {/* ── Player Pool Drawer ─────────────────────────────────────────── */}
      <PlayerPoolDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setActiveRoundId(undefined);
        }}
        tournamentId={tournamentId}
        auctionId={storeAuctionId}
        rounds={rounds}
        currentRoundId={activeRoundId}
        onRoundsChange={actions.refresh}
      />
    </>
  );
}