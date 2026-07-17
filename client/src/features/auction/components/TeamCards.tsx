import { Shield, Wallet2 } from "lucide-react";
import type { Franchise, Player } from "@/features/auction/types/index.types";
import { ROLE_ICONS } from "@/features/auction/constants/index.constants";
import { formatLakhs, initials } from "@/features/auction/utils/index.utils";

export function TeamBudgetCard({ franchise }: { franchise: Franchise }) {
  // reservedBudget is money locked by this team's own currently-leading bid
  // — already deducted from wallet.remainingBudget on the backend, so the
  // "remaining" figure here has to account for it too or it overstates what
  // this team can still bid with (see TournamentTeam.js wallet invariant).
  const remaining = franchise.purseTotal - franchise.spent - franchise.reservedBudget;
  const pctSpent = franchise.purseTotal > 0 ? ((franchise.spent + franchise.reservedBudget) / franchise.purseTotal) * 100 : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-xl text-sm font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${franchise.colorFrom}, ${franchise.colorTo})`,
          }}
        >
          {initials(franchise.shortName)}
        </span>
        <div>
          <p className="font-bold text-white">{franchise.name}</p>
          <p className="text-xs text-slate-500">Owner: {franchise.owner}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-black text-white">{formatLakhs(franchise.purseTotal)}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Total Purse</p>
        </div>
        <div>
          <p className="text-lg font-black text-rose-400">{formatLakhs(franchise.spent)}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Spent</p>
        </div>
        <div>
          <p className="text-lg font-black text-emerald-400">{formatLakhs(remaining)}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">Remaining</p>
        </div>
      </div>
      {franchise.reservedBudget > 0 && (
        <p className="mt-2 text-center text-[10px] text-amber-400/80">
          {formatLakhs(franchise.reservedBudget)} currently reserved on an active bid
        </p>
      )}
      <div className="mt-4 flex items-center gap-2">
        <Wallet2 className="h-3.5 w-3.5 text-slate-500" />
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-rose-400 to-amber-400"
            style={{ width: `${Math.min(100, pctSpent)}%` }}
          />
        </div>
        <span className="text-[10px] text-slate-500">{pctSpent.toFixed(0)}%</span>
      </div>
    </div>
  );
}

export function TeamRosterCard({
  franchise,
  players,
}: {
  franchise: Franchise;
  players: Player[];
}) {
  const squad = players.filter((p) => franchise.squad?.includes(p.id) ?? false);
  const overseasCount = squad.filter((p) => p.overseas).length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-slate-400">
          <Shield className="h-3.5 w-3.5" /> Squad
        </p>
        <span className="text-xs text-slate-400">
          {squad.length}/{franchise.maxSquadSize} · {overseasCount}/{franchise.maxOverseas} overseas
        </span>
      </div>
      {squad.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-600">No players acquired yet</p>
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {squad.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg bg-white/[0.02] px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-[10px] font-bold text-white">
                  {initials(p.name)}
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-200">{p.name}</p>
                  <p className="text-[10px] text-slate-500">
                    {ROLE_ICONS[p.role]} {p.role} {p.overseas && "· Overseas"}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-400">
                {formatLakhs(p.soldPrice ?? 0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}