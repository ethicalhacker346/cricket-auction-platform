import { ArrowRight, Infinity as InfinityIcon, Loader2, Repeat2 } from 'lucide-react';
import type { AuctionRound, Player } from '../types/index.types';
import { roundProgress, unsoldPassLabel } from '../utils/roundProgress';

export function UnsoldPassNotice({ round, players, hasActiveLot, busy, canContinue, onContinue }: {
  round: AuctionRound; players: Player[]; hasActiveLot: boolean; busy: boolean;
  canContinue: boolean; onContinue: () => void;
}) {
  const progress = roundProgress(round, new Map(players.map((player) => [player.id, player])));
  // A pre-upgrade pass can already be exhausted yet still ACTIVE. Normal new
  // passes advance automatically; this explicit audited repair is never a poll mutation.
  const exhausted = !hasActiveLot && progress.total > 0 && progress.processed === progress.total;
  return <section aria-label="Unsold pass progress" className="mb-4 overflow-hidden rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.08] via-orange-300/[0.025] to-transparent">
    <div className="flex items-start justify-between gap-3 px-3.5 pt-3.5">
      <div>
        <h4 className="flex items-center gap-2 text-sm font-bold text-amber-100"><Repeat2 className="h-4 w-4 text-amber-300" />{unsoldPassLabel(round)}</h4>
        <p className="mt-1 text-[11px] leading-5 text-slate-400">One offer per player, per pass. Another chance is not a permanent retirement.</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 rounded-full border border-amber-200/10 bg-amber-200/5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-200/70"><InfinityIcon className="h-3 w-3" /> Repeatable</span>
    </div>
    <div className="mx-3.5 mt-3 h-1.5 overflow-hidden rounded-full bg-white/5" role="progressbar" aria-label="Players processed in this unsold pass" aria-valuenow={progress.processed} aria-valuemin={0} aria-valuemax={progress.total}>
      <div className="h-full rounded-full bg-gradient-to-r from-amber-200 to-orange-400 transition-[width] motion-reduce:transition-none" style={{ width: `${progress.percent}%` }} />
    </div>
    <div className="grid grid-cols-3 gap-2 px-3.5 py-3 text-[10px] text-slate-500">
      <div><strong className="block font-mono text-sm text-slate-100">{progress.processed}/{progress.total}</strong>Processed this pass</div>
      <div><strong className="block font-mono text-sm text-amber-200">{progress.unsold}</strong>Deferred to next pass</div>
      <div><strong className="block font-mono text-sm text-slate-100">{progress.pending}</strong>Waiting to be offered</div>
    </div>
    <div className="border-t border-amber-200/10 bg-black/10 px-3.5 py-3 text-[11px] leading-5 text-slate-400">
      <p><strong className="font-semibold text-amber-200">Force Unsold</strong> defers this player. <strong className="font-semibold text-rose-200">Permanent Unsold</strong> removes them from all later passes. Bids reserved for an unsold player are released.</p>
      <p className="mt-1 flex items-start gap-1.5"><ArrowRight className="mt-1 h-3 w-3 shrink-0 text-amber-300/60" />After every player is processed, remaining unsold players form the next numbered pass. The auction ends only when all approved players are sold or permanently unsold.</p>
      {exhausted && canContinue && <button type="button" disabled={busy} onClick={onContinue} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 text-xs font-bold text-amber-100 hover:bg-amber-200/20 focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-40">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Repeat2 className="h-4 w-4" />} Continue unsold passes
      </button>}
    </div>
  </section>;
}
