import { useMemo, useState } from 'react';
import { Check, Gavel, Search, Users } from 'lucide-react';
import type { AuctionRound, Player } from '../types/index.types';
import { eligibleRoundPlayers, runningAuctionRound } from '../utils/roundSelection';
import { formatLakhs } from '../utils/index.utils';
import { CricHeroesLink } from '@/components/player/CricHeroesLink';

export function NextLotPicker({ rounds, players, selectedId, onSelect, disabled }: {
  rounds: AuctionRound[]; players: Player[]; selectedId: string; onSelect: (id: string) => void; disabled: boolean;
}) {
  const [search, setSearch] = useState('');
  const round = runningAuctionRound(rounds);
  const eligible = useMemo(() => round ? eligibleRoundPlayers(round, players) : [], [round, players]);
  const filtered = eligible.filter((player) => `${player.name} ${player.role}`.toLowerCase().includes(search.trim().toLowerCase()));
  const selected = eligible.find((player) => player.id === selectedId) ?? eligible[0];
  return (
    <section aria-label="Choose next lot" className="mt-4 overflow-hidden rounded-xl border border-amber-300/15 bg-gradient-to-br from-amber-300/[0.05] to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-200"><Gavel className="h-3.5 w-3.5" /> Next on the floor</p>
          <p className="mt-1 text-xs text-slate-400">{round ? `${round.name} · ${eligible.length} eligible` : 'No remaining players in a configured round'}</p>
        </div>
        {selected && <p className="max-w-full truncate text-xs text-slate-300">Selected: <strong className="text-white">{selected.name}</strong></p>}
      </div>
      {eligible.length > 0 && <>
        <label className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 text-slate-500">
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          <input aria-label="Search eligible players" type="search" value={search} onChange={(event) => setSearch(event.target.value)}
            placeholder="Search this round by player or role…" className="min-w-0 flex-1 bg-transparent py-2.5 text-xs text-white outline-none placeholder:text-slate-500" />
        </label>
        <div className="max-h-56 space-y-1 overflow-y-auto p-3" role="radiogroup" aria-label="Next player from running round">
          {filtered.map((player) => {
            const checked = selected?.id === player.id;
            return (
              <div key={player.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${checked ? 'border-amber-300/30 bg-amber-300/10' : 'border-transparent bg-white/[0.02]'}`}>
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-2">
                  <input type="radio" name="next-auction-player" value={player.id} checked={checked} disabled={disabled}
                    onChange={() => onSelect(player.id)} className="accent-amber-300" />
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-100">{player.name}</span>
                    <span className="block text-[11px] text-slate-400">{player.role} · {formatLakhs(player.basePrice)}</span></span>
                  {checked && <Check className="ml-auto h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />}
                </label>
                <CricHeroesLink url={player.cricHeroesUrl} playerName={player.name} className="text-emerald-300" />
              </div>
            );
          })}
          {!filtered.length && <p className="py-5 text-center text-xs text-slate-500"><Users className="mx-auto mb-2 h-4 w-4" />No matching players in this round.</p>}
        </div>
      </>}
      <p className="border-t border-white/5 px-4 py-2.5 text-[11px] text-slate-500">{disabled ? 'Finish the current lot, then open your selection.' : 'Choose any eligible player in this round. Later rounds stay locked.'}</p>
    </section>
  );
}
