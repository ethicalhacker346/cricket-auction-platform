import { ArrowRight, Plus, Radio, Sparkles } from 'lucide-react';
import type { AdminOverview } from '@/types/adminDashboard';
import { formatCount, formatRupees } from '@/lib/formatters';

export function AdminHero({
  overview,
  adminName,
  onCreateTournament,
  onOpenLiveFloor,
}: {
  overview: AdminOverview;
  adminName: string;
  onCreateTournament: () => void;
  onOpenLiveFloor: () => void;
}) {
  const firstName = adminName.trim().split(' ')[0] || 'Admin';
  return (
    <section className="hero-card">
      <div className="hero-grid-glow" />
      <div className="hero-copy">
        <div className="eyebrow"><span className="live-pill"><i /> Live operations</span><span className="eyebrow-separator">·</span><span>Read-only overview</span></div>
        <h1>Good morning, {firstName} <span className="wave">✦</span></h1>
        <p>Here’s the pulse of your cricket auction universe. Keep registrations, rooms, and unresolved lots moving.</p>
        <div className="hero-actions"><button type="button" className="primary-button" onClick={onCreateTournament}><Plus size={17} /> Create tournament</button><button type="button" className="ghost-button" onClick={onOpenLiveFloor}>Open live floor <ArrowRight size={16} /></button></div>
      </div>
      <div className="hero-pulse">
        <div className="pulse-orbit orbit-one" /><div className="pulse-orbit orbit-two" />
        <div className="pulse-core"><Radio size={21} /><span>API</span><small>connected</small></div>
        <span className="pulse-label label-one">Overview ready</span>
        <span className="pulse-label label-two">{formatCount(overview.activity.activeAuctionViewers)} watching</span>
        <span className="pulse-label label-three">{formatRupees(overview.activity.totalSoldValue)} traded</span>
      </div>
      <div className="hero-corner"><Sparkles size={16} /> Command center</div>
    </section>
  );
}
