"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Users, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PlayerPoolTable } from "./PlayerPoolTable";
import { usePlayerPool } from "@/features/auction/hooks/usePlayerPool";
import type { AuctionRound } from "@/features/auction/types/index.types";

interface PlayerPoolDrawerProps {
  open: boolean;
  onClose: () => void;
  tournamentId?: string;
  auctionId?: string;
  rounds: AuctionRound[];
  currentRoundId?: string;
  onRoundsChange: () => void;
}

export function PlayerPoolDrawer({
  open,
  onClose,
  tournamentId,
  auctionId,
  rounds,
  currentRoundId,
  onRoundsChange,
}: PlayerPoolDrawerProps) {
  const [activeTab, setActiveTab] = useState<"all" | "round">("all");

  const pool = usePlayerPool({
    tournamentId,
    auctionId,
    rounds,
    onRoundsChange,
  });

  const currentRound = rounds.find((r) => r.id === currentRoundId);

  // When in "round" tab, only show players already in this round
  const displayPlayers =
    activeTab === "round" && currentRoundId
      ? pool.players.filter((p) => pool.playerRoundMap.get(p.id) === currentRoundId)
      : pool.filteredPlayers;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-4xl flex-col border-l border-white/10 bg-slate-950 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                  <Users className="h-5 w-5 text-amber-400" />
                  Player Pool
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {currentRound
                    ? `Managing players for "${currentRound.name}"`
                    : "Select players to assign to rounds"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="rounded-full text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Tabs */}
            {currentRoundId && (
              <div className="flex border-b border-white/10 px-5">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`relative px-4 py-3 text-sm font-semibold transition ${
                    activeTab === "all"
                      ? "text-amber-400"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  All Players
                  {activeTab === "all" && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400"
                    />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab("round")}
                  className={`relative px-4 py-3 text-sm font-semibold transition ${
                    activeTab === "round"
                      ? "text-amber-400"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    In This Round
                    <span className="rounded-full bg-white/10 px-1.5 py-0 text-[10px] text-slate-400">
                      {currentRound?.playerIds.length ?? 0}
                    </span>
                  </span>
                  {activeTab === "round" && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400"
                    />
                  )}
                </button>
              </div>
            )}

            {/* Content */}
            <div className="relative flex-1 overflow-hidden">
              <PlayerPoolTable
                players={displayPlayers}
                rounds={rounds}
                loading={pool.loading}
                error={pool.error}
                searchQuery={pool.searchQuery}
                onSearchChange={pool.setSearchQuery}
                roleFilter={pool.roleFilter}
                onToggleRole={pool.toggleRole}
                onClearFilters={pool.clearFilters}
                selectedIds={pool.selectedIds}
                onToggleSelection={pool.toggleSelection}
                onSelectAll={pool.selectAll}
                onClearSelection={pool.clearSelection}
                assigning={pool.assigning}
                assignError={pool.assignError}
                onAssignToRound={pool.assignToRound}
                onRemoveFromRound={pool.removeFromRound}
                currentRoundId={currentRoundId}
                playerRoundMap={pool.playerRoundMap}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}