import { AlertTriangle, ArrowRight, ArrowUpRight, Building2, CheckCircle2, CircleHelp, Database, Users } from 'lucide-react';
import type { AdminOverview } from '@/types/adminDashboard';
import { formatCount } from '@/lib/formatters';

type Tone = 'amber' | 'violet' | 'red';

export function AttentionPanel({ overview, onAction }: { overview: AdminOverview; onAction: (message: string) => void }) {
  const items: Array<{ label: string; value: number; sub: string; tone: Tone; icon: typeof Users; action: string }> = [
    { label: 'Player registrations waiting', value: overview.attention.pendingPlayerRegistrations, sub: 'Verification queue', tone: 'amber', icon: Users, action: '/admin/attention?type=players' },
    { label: 'Team registrations waiting', value: overview.attention.pendingTeamRegistrations, sub: 'Approval queue', tone: 'violet', icon: Building2, action: '/admin/attention?type=teams' },
    { label: 'Auction players unresolved', value: overview.attention.unresolvedAuctionPlayers, sub: 'Needs resolution before close', tone: 'red', icon: AlertTriangle, action: '/admin/attention?type=unresolved' },
  ];
  const mismatchCount = overview.dataQuality?.soldStateMismatches ?? 0;
  const unknownTournamentStatuses = overview.tournaments.byStatus.UNKNOWN ?? 0;
  return (
    <section className="panel attention-panel">
      <div className="panel-heading compact-heading"><div><div className="section-kicker"><span className="kicker-mark orange"><AlertTriangle size={13} /></span> Requires attention</div><h2>Keep the floor clean</h2></div><span className="attention-count">{formatCount(items.reduce((sum, item) => sum + item.value, 0))} open</span></div>
      <div className="attention-list">{items.map((item) => { const Icon = item.icon; return <button type="button" className="attention-item" key={item.label} onClick={() => onAction(item.action)}><span className={`attention-icon ${item.tone}`}><Icon size={17} /></span><span className="attention-copy"><strong>{item.label}</strong><small>{item.sub}</small></span><strong className={`attention-value ${item.tone}`}>{formatCount(item.value)}</strong><ArrowRight size={15} className="attention-arrow" /></button>; })}</div>
      {mismatchCount > 0 && <button type="button" className="quality-warning" onClick={() => onAction('/admin/data-quality?type=sold-state')}><Database size={15} /><span><strong>{mismatchCount} sold-state mismatch{mismatchCount > 1 ? 'es' : ''}</strong><small>Reconciliation signal detected</small></span><ArrowRight size={15} /></button>}
      {unknownTournamentStatuses > 0 && <button type="button" className="quality-warning unknown-warning" onClick={() => onAction('/admin/data-quality?type=tournament-status')}><Database size={15} /><span><strong>{unknownTournamentStatuses} tournament status record{unknownTournamentStatuses > 1 ? 's' : ''} need review</strong><small>Unrecognized status values detected by the API</small></span><ArrowRight size={15} /></button>}
      <div className="attention-footer"><span><CircleHelp size={14} /> Delivery health tracked separately</span><button type="button" onClick={() => onAction('/admin/attention')}>Open attention center <ArrowUpRight size={14} /></button></div>
    </section>
  );
}

