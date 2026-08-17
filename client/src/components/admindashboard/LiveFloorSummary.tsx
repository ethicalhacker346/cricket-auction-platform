import { ArrowUpRight, Eye, Gavel, PauseCircle, Radio, ShieldAlert, Users } from 'lucide-react';
import type { AdminOverview } from '@/types/adminDashboard';
import { formatCount } from '@/lib/formatters';

export function LiveFloorSummary({ overview, onAction }: { overview: AdminOverview; onAction: (message: string) => void }) {
  const live = overview.auctions.byStatus.LIVE ?? 0;
  const paused = overview.auctions.byStatus.PAUSED ?? 0;
  const scheduled = overview.auctions.byStatus.SCHEDULED ?? 0;
  const totalOperational = live + paused + scheduled;
  const liveShare = totalOperational ? (live / totalOperational) * 100 : 0;
  const pausedShare = totalOperational ? (paused / totalOperational) * 100 : 0;
  return (
    <section className="panel live-floor-panel">
      <div className="panel-heading"><div><div className="section-kicker"><span className="live-dot-large"><i /></span> Live floor</div><h2>Rooms in play</h2></div><div className="live-floor-actions"><span className="viewer-total"><Eye size={14} /> {formatCount(overview.activity.activeAuctionViewers)} watching</span><button type="button" className="text-button" onClick={() => onAction('/admin/auctions?status=LIVE')}>Open monitor <ArrowUpRight size={14} /></button></div></div>
      <div className="live-summary-grid">
        <div className="live-summary-card live"><span className="live-summary-icon"><Radio size={17} /></span><span><strong>{formatCount(live)}</strong><small>live auctions</small></span><i className="live-summary-pulse" /></div>
        <div className="live-summary-card paused"><span className="live-summary-icon"><PauseCircle size={17} /></span><span><strong>{formatCount(paused)}</strong><small>paused rooms</small></span></div>
        <div className="live-summary-card scheduled"><span className="live-summary-icon"><Gavel size={17} /></span><span><strong>{formatCount(scheduled)}</strong><small>scheduled next</small></span></div>
        <div className="live-summary-card attention"><span className="live-summary-icon"><ShieldAlert size={17} /></span><span><strong>{formatCount(overview.attention.unresolvedAuctionPlayers)}</strong><small>unresolved lots</small></span></div>
      </div>
      <div className="floor-status-strip"><div className="floor-status-heading"><span>Current room posture</span><small>aggregate overview signal</small></div><div className="floor-bar"><span className="floor-bar-live" style={{ width: `${liveShare}%` }} /><span className="floor-bar-paused" style={{ width: `${pausedShare}%` }} /><span className="floor-bar-scheduled" style={{ width: `${Math.max(100 - liveShare - pausedShare, 0)}%` }} /></div><div className="floor-legend"><span><i className="floor-live-dot" />{formatCount(live)} live</span><span><i className="floor-paused-dot" />{formatCount(paused)} paused</span><span><i className="floor-scheduled-dot" />{formatCount(scheduled)} scheduled</span><span className="floor-capacity"><Users size={13} />{formatCount(overview.activity.activeAuctionViewers)} viewers</span></div></div>
      <div className="live-floor-note"><span><Eye size={15} /><strong>Room-level details are intentionally not fabricated</strong><small>Connect the future admin auctions listing endpoint to populate current lots, teams, and bids.</small></span><button type="button" onClick={() => onAction('/admin/auctions')}>Go to auctions <ArrowUpRight size={15} /></button></div>
    </section>
  );
}
