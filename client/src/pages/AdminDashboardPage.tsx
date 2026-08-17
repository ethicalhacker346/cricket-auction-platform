import { useMemo, useState } from 'react';
import { CircleDollarSign, Gavel, Radio, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { formatCompact, formatCount, formatRupees } from '@/lib/formatters';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { AdminLayout } from '@/layout/AdminLayout';
import { AdminHero } from '@/components/admindashboard/AdminHero';
import { MetricCard } from '@/components/admindashboard/MetricCard';
import { AuctionSignalPanel } from '@/components/admindashboard/AuctionSignalPanel';
import { AuctionPortfolioPanel } from '@/components/admindashboard/AuctionPortfolioPanel';
import { AttentionPanel } from '@/components/admindashboard/AttentionPanel';
import { RecentActivityPanel } from '@/components/admindashboard/RecentActivityPanel';
import { LiveFloorSummary } from '@/components/admindashboard/LiveFloorSummary';
import { TournamentPipelinePanel } from '@/components/admindashboard/TournamentPipelinePanel';
import { DashboardFooter } from '@/components/admindashboard/DashboardFooter';
import { OverviewErrorState } from '@/components/admindashboard/OverviewErrorState';
import { OverviewSkeleton } from '@/components/admindashboard/OverviewSkeleton';

export function AdminDashboardPage() {
  const [lastSync, setLastSync] = useState(new Date());
  const { data: overview, isLoading, isFetching, isError, refetch } = useAdminDashboard();

  const pageDate = useMemo(() => format(new Date(), 'EEEE, d MMMM yyyy'), []);
  const generatedAt = overview?.meta?.generatedAt ? new Date(overview.meta.generatedAt) : null;
  const syncDate = generatedAt && !Number.isNaN(generatedAt.getTime()) ? generatedAt : lastSync;

  const refreshDashboard = async () => {
    const result = await refetch();
    if (result.data) setLastSync(new Date());
  };

  return (
    <AdminLayout lastSync={syncDate} isFetching={isFetching} onRefresh={refreshDashboard}>
      {({ navigateTo, notify, identity }) => {
        const liveCount = overview?.attention.liveAuctions ?? 0;
        return <>
          {isLoading && <OverviewSkeleton />}
          {!isLoading && isError && <OverviewErrorState onRetry={() => refetch()} />}
          {!isLoading && !isError && overview && <div className="dashboard-content">
            <AdminHero overview={overview} adminName={identity.name} onCreateTournament={() => navigateTo('/tournaments/create')} onOpenLiveFloor={() => navigateTo(`${ADMIN_ROUTES.auctions}?status=LIVE`)} />
            <div className="dashboard-heading-row"><div><span className="section-kicker plain">Your operating snapshot</span><span className="snapshot-date">{pageDate}</span></div><div className="heading-status"><span className="status-dot" /> API healthy <span className="heading-divider" /><span>{liveCount} live {liveCount === 1 ? 'auction' : 'auctions'}</span></div></div>
            <div className="metric-grid">
              <MetricCard icon={Users} label="Platform users" value={formatCompact(overview.platform.users)} support={`${formatCount(overview.platform.activeUsers)} active accounts`} trend="live" tone="lime" detail="account health" onOpen={() => navigateTo(ADMIN_ROUTES.users)} />
              <MetricCard icon={Radio} label="Live auctions" value={formatCount(overview.attention.liveAuctions)} support={`${formatCount(overview.activity.activeAuctionViewers)} viewers in rooms`} tone="blue" detail="right now" onOpen={() => navigateTo(`${ADMIN_ROUTES.auctions}?status=LIVE`)} />
              <MetricCard icon={Gavel} label="Total bids" value={formatCompact(overview.activity.totalBids)} support={`${formatCount(overview.activity.soldPlayers)} players sold`} tone="violet" detail="auction lifetime" onOpen={() => navigateTo(`${ADMIN_ROUTES.auctions}?view=bids`)} />
              <MetricCard icon={CircleDollarSign} label="Total sold value" value={formatRupees(overview.activity.totalSoldValue)} support={`${formatCount(overview.activity.unsoldPlayers)} unsold players`} tone="amber" detail="across platform" onOpen={() => navigateTo(ADMIN_ROUTES.analytics)} />
            </div>
            <div className="dashboard-grid dashboard-grid-top"><AuctionSignalPanel overview={overview} /><AuctionPortfolioPanel overview={overview} onAction={navigateTo} /></div>
            <div className="dashboard-grid dashboard-grid-middle"><AttentionPanel overview={overview} onAction={navigateTo} /><RecentActivityPanel activities={overview.recentActivity} onAction={navigateTo} /></div>
            <LiveFloorSummary overview={overview} onAction={navigateTo} />
            <TournamentPipelinePanel overview={overview} onNavigate={navigateTo} />
            <DashboardFooter />
          </div>}
        </>;
      }}
    </AdminLayout>
  );
}
