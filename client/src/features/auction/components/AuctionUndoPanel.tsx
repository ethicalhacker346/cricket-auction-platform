import { useEffect, useState } from 'react';
import { AlertTriangle, History, Loader2, RotateCcw, ShieldCheck } from 'lucide-react';
import type { UndoableAuctionAction } from '../types/index.types';
import { AuctionDialog } from './AuctionDialog';
import { auctionApi } from '../api/index.api';

export function AuctionUndoPanel({ auctionId, action, onUndo }: {
  auctionId: string; action: UndoableAuctionAction | null;
  onUndo: (actionId: string, reason?: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const [review, setReview] = useState<UndoableAuctionAction | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof auctionApi.getActionHistory>>>([]);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  const stale = !!review && review.id !== action?.id;
  useEffect(() => {
    if (!showHistory) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError('');
    auctionApi.getActionHistory(auctionId).then((rows) => { if (!cancelled) setHistory(rows); })
      .catch((error: Error) => { if (!cancelled) setHistoryError(error.message); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [showHistory, auctionId, action?.id]);

  const confirm = async () => {
    if (!review || stale || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await onUndo(review.id, reason.trim() || undefined);
      setMessage({ error: !result.success, text: result.success ? 'Action undone. Any restored bidding lot is paused for review.' : result.error || 'Undo failed' });
      setReview(null);
    } catch (error) {
      setMessage({ error: true, text: error instanceof Error ? error.message : 'Undo failed' });
    } finally { setBusy(false); }
  };

  return (
    <section className="mt-4 rounded-xl border border-sky-300/15 bg-sky-300/[0.03] p-3.5" aria-label="Organizer undo">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-200"><ShieldCheck className="h-3.5 w-3.5" /> Organizer safety net</p>
          <p className="mt-1.5 break-words text-xs text-slate-300">{action?.label || 'No recorded actions to undo yet.'}</p>
          <p className="mt-1 text-[10px] text-slate-500">Undo one step at a time. Bids, purses, squads and round progress are restored together.</p>
        </div>
        <button type="button" disabled={!action || busy} onClick={() => { setReview(action); setReason(''); setMessage(null); }}
          className="flex items-center gap-2 rounded-lg border border-sky-300/20 bg-sky-300/10 px-3 py-2.5 text-xs font-bold text-sky-200 transition hover:bg-sky-300/20 focus-visible:ring-2 focus-visible:ring-sky-200 disabled:cursor-not-allowed disabled:opacity-35">
          <RotateCcw className="h-3.5 w-3.5" /> Undo latest
        </button>
      </div>
      {message && <p role={message.error ? 'alert' : 'status'} className={`mt-3 text-xs ${message.error ? 'text-rose-300' : 'text-emerald-300'}`}>{message.text}</p>}
      <button type="button" onClick={() => setShowHistory((value) => !value)} className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white" aria-expanded={showHistory}>
        <History className="h-3 w-3" /> {showHistory ? 'Hide' : 'View'} recent audit trail
      </button>
      {showHistory && <div className="mt-3 max-h-60 space-y-2 overflow-y-auto border-t border-white/5 pt-3">
        {historyLoading && <p role="status" className="text-xs text-slate-500">Loading audit trail…</p>}
        {historyError && <p role="alert" className="text-xs text-rose-300">{historyError}</p>}
        {!historyLoading && !history.length && !historyError && <p className="text-xs text-slate-500">History starts with actions made after this feature was enabled.</p>}
        {history.map((row) => <div key={row._id} className="rounded-lg bg-black/20 p-2.5 text-xs">
          <span className={row.status === 'UNDONE' ? 'text-slate-500 line-through' : 'text-slate-300'}>{row.label}</span>
          <p className="mt-1 text-[10px] text-slate-500">{new Date(row.createdAt).toLocaleString()} · {row.status === 'UNDONE' ? 'Undone' : 'Applied'}</p>
          {row.undoReason && <p className="mt-1 text-sky-300/80">Reason: {row.undoReason}</p>}
        </div>)}
      </div>}
      {review && <AuctionDialog title="Undo latest auction action?" onClose={() => setReview(null)} busy={busy}>
        <p className="break-words rounded-xl border border-sky-300/15 bg-sky-300/5 p-4 text-sm font-semibold text-white">{review.label}</p>
        <div className="my-4 flex items-start gap-2.5 text-xs leading-6 text-slate-400">
          <AlertTriangle className="mt-1 h-4 w-4 shrink-0 text-amber-300" />
          <p>This reverses the latest action and its automatic effects, including wallet reservations, sales and round completion. A restored bidding lot opens paused. Cancelled bids remain in the audit history. There is no redo.</p>
        </div>
        {stale && <p role="alert" className="mb-4 rounded-lg bg-amber-300/10 p-3 text-xs text-amber-200">A newer action arrived. Close this dialog and review the latest action before undoing.</p>}
        <label className="block text-xs font-semibold text-slate-400" htmlFor="auction-undo-reason">Reason (optional, recorded in the audit trail)</label>
        <textarea id="auction-undo-reason" maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} rows={2} disabled={busy}
          className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-sky-300/50" placeholder="e.g. Accidental tap or incorrect sale decision" />
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setReview(null)} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5">Cancel</button>
          <button type="button" disabled={busy || stale} onClick={() => void confirm()} className="flex items-center gap-2 rounded-lg bg-sky-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-sky-200 disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Confirm undo
          </button>
        </div>
      </AuctionDialog>}
    </section>
  );
}
