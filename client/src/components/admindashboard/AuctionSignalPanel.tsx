import { Activity, CircleDollarSign, Eye, Gavel, MoreHorizontal, Zap } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { AdminOverview } from '@/types/adminDashboard';
import { formatCount, formatRupees, toTitleCase } from '@/lib/formatters';

const lotColors: Record<string, string> = {
  SOLD: '#a3e635',
  UNSOLD: '#f6c65f',
  PERMANENT_UNSOLD: '#fb7185',
  IN_PROGRESS: '#72b8ff',
  NOT_LISTED: '#526a80',
};

function SignalTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; value: number; color: string } }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return <div className="chart-tooltip"><strong>{item.label}</strong><div><i style={{ background: item.color }} />Registrations <b>{formatCount(item.value)}</b></div></div>;
}

export function AuctionSignalPanel({ overview }: { overview: AdminOverview }) {
  const byLotOutcome = overview.activity.playersByLotOutcome ?? {};
  const lotData = ['SOLD', 'UNSOLD', 'PERMANENT_UNSOLD', 'IN_PROGRESS', 'NOT_LISTED'].map((key) => ({
    key,
    label: toTitleCase(key),
    value: byLotOutcome[key] ?? 0,
    color: lotColors[key],
  }));
  const bidStatuses = overview.activity.bidByStatus ?? {};
  const totalBidStatuses = Object.values(bidStatuses).reduce((sum, value) => sum + value, 0);
  const winningShare = totalBidStatuses ? Math.round(((bidStatuses.WINNING ?? 0) / totalBidStatuses) * 100) : 0;

  return (
    <section className="panel signal-panel">
      <div className="panel-heading">
        <div><div className="section-kicker"><span className="kicker-mark"><Activity size={13} /></span> Current auction signal</div><h2>Inventory and bidding posture</h2></div>
        <button type="button" className="panel-more" aria-label="More auction signal options"><MoreHorizontal size={18} /></button>
      </div>
      <div className="signal-stat-row">
        <div className="signal-stat"><span className="signal-stat-icon lime"><CircleDollarSign size={15} /></span><span><strong>{formatRupees(overview.activity.totalSoldValue)}</strong><small>total sold value</small></span></div>
        <div className="signal-stat"><span className="signal-stat-icon blue"><Gavel size={15} /></span><span><strong>{formatCount(overview.activity.totalBids)}</strong><small>lifetime bids</small></span></div>
        <div className="signal-stat"><span className="signal-stat-icon purple"><Eye size={15} /></span><span><strong>{formatCount(overview.activity.activeAuctionViewers)}</strong><small>active viewers</small></span></div>
      </div>
      <div className="signal-chart-heading"><span>Lot outcomes</span><span>live aggregate snapshot</span></div>
      <div className="signal-chart-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={lotData} layout="vertical" margin={{ top: 2, right: 9, left: 8, bottom: 0 }} barCategoryGap={7}>
            <CartesianGrid horizontal={false} stroke="#26364a" strokeDasharray="3 6" />
            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#71839a', fontSize: 10 }} tickFormatter={(value: number) => value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`} />
            <YAxis type="category" dataKey="label" axisLine={false} tickLine={false} width={95} tick={{ fill: '#8ca1ad', fontSize: 9 }} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,.03)' }} content={<SignalTooltip />} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={17}>
              {lotData.map((item) => <Cell key={item.key} fill={item.color} fillOpacity={item.key === 'NOT_LISTED' ? .65 : 1} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="signal-footer"><span><Zap size={13} /> {winningShare}% of active bid records are currently winning</span><span>{formatCount(byLotOutcome.SOLD ?? 0)} sold lots</span></div>
    </section>
  );
}

