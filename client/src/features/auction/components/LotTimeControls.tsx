import { useEffect, useId, useRef, useState } from 'react';
import { Clock3, Loader2, Plus, TimerReset } from 'lucide-react';
import type { AuctionStatus, LotTimeCommandResult, Player, TimerState } from '../types/index.types';
import { auctionCommandId } from '../utils/requestBackoff';
import { formatSeconds } from '../utils/index.utils';

export function LotTimeControls({ player, timer, status, disabled, onExtend }: {
  player: Player; timer: TimerState; status: AuctionStatus; disabled: boolean;
  onExtend: (playerId: string, seconds: number, requestId: string) => Promise<LotTimeCommandResult>;
}) {
  const id = useId();
  const [seconds, setSeconds] = useState('30');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ playerId: string; error: boolean; text: string } | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [uncertain, setUncertain] = useState<{ playerId: string; seconds: number; requestId: string } | null>(null);
  const unresolved = uncertain?.playerId === player.id ? uncertain : null;
  const currentPlayer = useRef(player.id); currentPlayer.current = player.id;
  const expired = timer.remaining <= 0;
  const custom = Number(seconds);
  const valid = seconds.trim() !== '' && Number.isSafeInteger(custom) && custom >= 5 && custom <= 300;
  const add = async (amount: number, requestId = auctionCommandId()) => {
    if (disabled || inFlight.current) return;
    inFlight.current = true; setPending(true); setMessage(null);
    const playerId = player.id;
    try {
      const result = await onExtend(playerId, amount, requestId);
      if (!mounted.current) return;
      setUncertain(!result.success && result.uncertain ? { playerId, seconds: amount, requestId } : null);
      if (currentPlayer.current === playerId) setMessage({ playerId, error: !result.success,
        text: result.success ? `${amount} seconds added to ${player.name}'s lot.${status === 'paused' ? ' Resume the auction when ready.' : ''}` : result.error || 'Could not add time. Review the live clock before retrying.' });
    } catch (error) {
      if (!mounted.current) return;
      setUncertain({ playerId, seconds: amount, requestId });
      if (currentPlayer.current === playerId) setMessage({ playerId, error: true, text: error instanceof Error ? error.message : 'Could not add time' });
    } finally { inFlight.current = false; if (mounted.current) setPending(false); }
  };

  return (
    <section aria-label="Extra time for current lot" className={`mt-4 overflow-hidden rounded-xl border ${expired ? 'border-amber-300/25 bg-amber-300/[0.05]' : 'border-cyan-300/15 bg-cyan-300/[0.035]'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 px-4 py-3">
        <div className="min-w-0">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-200"><TimerReset className="h-4 w-4" /> Extra time <span className="text-[10px] normal-case tracking-normal text-slate-500">This lot only</span></h4>
          <p className="mt-1 truncate text-xs text-slate-400">{player.name}</p>
        </div>
        <span className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-sm font-bold tabular-nums ${expired ? 'bg-amber-300/10 text-amber-200' : 'bg-black/20 text-white'}`}><Clock3 className="h-3.5 w-3.5" />{formatSeconds(timer.remaining)}</span>
      </div>
      <div className="p-3.5">
        <p className="mb-3 text-xs leading-5 text-slate-400">{status === 'paused'
          ? 'Add time now; the clock stays paused until you choose Resume.'
          : expired ? 'The clock has ended. Add time to reopen bidding for this player.' : 'Give owners more time without changing later lots or the current winning bid.'}</p>
        <div className="grid grid-cols-3 gap-2">
          {[10, 30, 60].map((amount) => <button key={amount} type="button" aria-label={`Add ${amount} seconds`} disabled={disabled || pending || Boolean(unresolved)} onClick={() => void add(amount)}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-2 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/20 focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}{amount}s
          </button>)}
        </div>
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); if (valid && !unresolved) void add(custom); }}>
          <div className="min-w-0 flex-1">
            <label htmlFor={id} className="text-[11px] font-semibold text-slate-400">Custom seconds (5–300)</label>
            <input id={id} type="number" inputMode="numeric" min={5} max={300} step={1} value={seconds} disabled={disabled || pending || Boolean(unresolved)}
              onChange={(event) => setSeconds(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3 text-sm text-white outline-none focus:border-cyan-300/50" />
          </div>
          <button type="submit" disabled={!valid || disabled || pending || Boolean(unresolved)} className="min-h-11 rounded-xl bg-cyan-200 px-4 text-xs font-bold text-slate-950 transition hover:bg-cyan-100 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40">Add custom time</button>
        </form>
        <p className="mt-2 text-[10px] leading-4 text-slate-500">Only the organizer can extend this clock. Changes are recorded and can be undone.</p>
        {unresolved && <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3">
          <p className="text-xs leading-5 text-amber-100">The result is not confirmed. The clock may already have changed. This retry reuses the same request and cannot add time twice.</p>
          <button type="button" disabled={disabled || pending} onClick={() => void add(unresolved.seconds, unresolved.requestId)} className="mt-2 min-h-11 rounded-lg bg-amber-200 px-3 text-xs font-bold text-slate-950 disabled:opacity-40">Retry this {unresolved.seconds}s extension safely</button>
        </div>}
        {message?.playerId === player.id && <p role={message.error ? 'alert' : 'status'} className={`mt-3 text-xs leading-5 ${message.error ? 'text-rose-300' : 'text-emerald-300'}`}>{message.text}</p>}
      </div>
    </section>
  );
}
