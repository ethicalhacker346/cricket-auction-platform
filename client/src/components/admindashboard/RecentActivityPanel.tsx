import { Activity, AlertTriangle, ArrowUpRight, CheckCircle2, CircleDot, CircleDollarSign, Gavel, ListFilter, Radio, Zap } from 'lucide-react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import type { RecentActivity } from '@/types/adminDashboard';
import { formatActivityTime, formatExactDate } from '@/lib/formatters';

type IconType = ComponentType<LucideProps>;
const activityIcon: Record<string, { icon: IconType; tone: string }> = { LOT_SOLD: { icon: CircleDollarSign, tone: 'lime' }, BID_PLACED: { icon: Zap, tone: 'blue' }, AUCTION_STARTED: { icon: Radio, tone: 'violet' }, AUCTION_PAUSED: { icon: AlertTriangle, tone: 'amber' }, ROUND_COMPLETED: { icon: CheckCircle2, tone: 'teal' }, LOT_OPENED: { icon: Gavel, tone: 'blue' } };

export function RecentActivityPanel({ activities, onAction }: { activities: RecentActivity[]; onAction: (message: string) => void }) {
  return (
    <section className="panel recent-panel">
      <div className="panel-heading compact-heading"><div><div className="section-kicker"><span className="kicker-mark purple"><Activity size={13} /></span> Recent activity</div><h2>What’s happening now</h2></div><button type="button" className="panel-more" aria-label="Filter activity" onClick={() => onAction('/admin/audit-logs')}><ListFilter size={17} /></button></div>
      <div className="activity-timeline">{activities.slice(0, 5).map((item) => { const meta = activityIcon[item.action] ?? { icon: CircleDot, tone: 'slate' }; const Icon = meta.icon; return <div className="timeline-item" key={item.id}><div className={`timeline-icon ${meta.tone}`}><Icon size={15} /></div><div className="timeline-body"><div className="timeline-head"><strong>{item.action.replaceAll('_', ' ')}</strong><time title={formatExactDate(item.timestamp)}>{formatActivityTime(item.timestamp)}</time></div><p>{item.message ?? 'Auction activity recorded'}</p><span>{item.tournamentName ?? 'Auction workspace'} {item.actor?.name ? `· by ${item.actor.name}` : ''}</span></div></div>; })}</div>
      <button type="button" className="text-button activity-link" onClick={() => onAction('/admin/audit-logs')}>View full audit log <ArrowUpRight size={15} /></button>
    </section>
  );
}
