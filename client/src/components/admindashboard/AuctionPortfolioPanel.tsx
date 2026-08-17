import { ExternalLink, Gavel } from 'lucide-react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { AdminOverview } from '@/types/adminDashboard';

export function AuctionPortfolioPanel({ overview, onAction }: { overview: AdminOverview; onAction: (message: string) => void }) {
  const mixData = [
    { name: 'Live', value: overview.auctions.byStatus.LIVE ?? 0, color: '#a3e635' },
    { name: 'Paused', value: overview.auctions.byStatus.PAUSED ?? 0, color: '#fbbf24' },
    { name: 'Scheduled', value: overview.auctions.byStatus.SCHEDULED ?? 0, color: '#60a5fa' },
    { name: 'Completed', value: overview.auctions.byStatus.COMPLETED ?? 0, color: '#2dd4bf' },
    { name: 'Draft', value: overview.auctions.byStatus.DRAFT ?? 0, color: '#334155' },
  ];

  return (
    <section className="panel mix-panel">
      <div className="panel-heading compact-heading">
        <div><div className="section-kicker"><span className="kicker-mark blue"><Gavel size={13} /></span> Auction portfolio</div><h2>Rooms at a glance</h2></div>
        <button type="button" className="panel-more" aria-label="Open auction portfolio" onClick={() => onAction('/admin/auctions')}><ExternalLink size={16} /></button>
      </div>
      <div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={mixData} dataKey="value" nameKey="name" innerRadius={72} outerRadius={94} paddingAngle={4} stroke="none" cornerRadius={4}>{mixData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie></PieChart></ResponsiveContainer><div className="donut-center"><strong>{overview.auctions.total}</strong><span>total rooms</span></div></div>
      <div className="mix-legend">{mixData.slice(0, 4).map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{item.value}</strong></div>)}</div>
      <button type="button" className="text-button" onClick={() => onAction('/admin/auctions')}>View all auctions <ExternalLink size={15} /></button>
    </section>
  );
}
