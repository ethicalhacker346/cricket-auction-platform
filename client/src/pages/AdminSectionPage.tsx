import { useMemo, type ComponentType } from 'react';
import { Activity, ArrowUpRight, Bell, Building2, CheckCircle2, CircleAlert, CircleDollarSign, Database, Eye, Gavel, ShieldCheck, Trophy, UserRound, Users, Wifi } from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { useAdminResourceList } from '@/hooks/useAdminResourceList';
import { formatCount, formatRupees, toTitleCase } from '@/lib/formatters';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';
import { AdminLayout } from '@/layout/AdminLayout';
import { MetricCard } from '@/components/admindashboard/MetricCard';
import { AttentionPanel } from '@/components/admindashboard/AttentionPanel';
import { RecentActivityPanel } from '@/components/admindashboard/RecentActivityPanel';
import { OverviewErrorState } from '@/components/admindashboard/OverviewErrorState';
import { OverviewSkeleton } from '@/components/admindashboard/OverviewSkeleton';
import { AdminResourceTable } from '@/components/admindashboard/AdminResourceTable';
import type { AdminOverview } from '@/types/adminDashboard';
import type { AdminResource, AdminResourceKind, ResourceQuery } from '@/types/adminResources';

export type AdminSectionKind = 'tournaments' | 'auctions' | 'players' | 'franchises' | 'users' | 'audit' | 'systemHealth' | 'settings' | 'attention' | 'dataQuality' | 'analytics' | 'search' | 'notifications';

const resourceBySection: Partial<Record<AdminSectionKind, AdminResourceKind>> = { tournaments: 'tournaments', auctions: 'auctions', players: 'players', franchises: 'franchises', users: 'users', audit: 'audit-logs' };

const titles: Record<AdminSectionKind, { eyebrow: string; title: string; description: string }> = {
  tournaments: { eyebrow: 'Tournament operations', title: 'Tournament workspace', description: 'Navigate the lifecycle from draft to completed tournament using live platform records.' },
  auctions: { eyebrow: 'Auction operations', title: 'Auction workspace', description: 'Monitor room states, bid posture, sold value, and current operational pressure.' },
  players: { eyebrow: 'Player operations', title: 'Player workspace', description: 'Review player profiles, auction outcomes, and registration queues.' },
  franchises: { eyebrow: 'Franchise operations', title: 'Franchise workspace', description: 'Track franchise inventory and the team registration flow across the platform.' },
  users: { eyebrow: 'Access operations', title: 'Users & roles', description: 'Review platform account volume and the active administrator surface.' },
  audit: { eyebrow: 'Governance', title: 'Audit log', description: 'Review recent auction activity and query the server-side audit stream.' },
  systemHealth: { eyebrow: 'Reliability', title: 'System health', description: 'Confirm the admin API and database health without inferring unsupported metrics.' },
  settings: { eyebrow: 'Workspace', title: 'Admin settings', description: 'Review the authenticated administrator session and workspace configuration.' },
  attention: { eyebrow: 'Operational queue', title: 'Attention center', description: 'Move pending registrations and unresolved auction players to the right workflow.' },
  dataQuality: { eyebrow: 'Data integrity', title: 'Data-quality center', description: 'Surface unknown states and reconciliation signals before they become operational incidents.' },
  analytics: { eyebrow: 'Decision support', title: 'Analytics workspace', description: 'Use the live overview snapshot today; historical analytics can plug into the next endpoint.' },
  search: { eyebrow: 'Global search', title: 'Search workspace', description: 'Search routing is ready; resource-specific search results are available from the admin directories.' },
  notifications: { eyebrow: 'Communication', title: 'Notifications', description: 'Open the existing notification center or review the current admin communication boundary.' },
};

function statusRows(map: Record<string, number>) { return Object.entries(map).sort(([, a], [, b]) => b - a); }

function SectionHeader({ kind, query, onNavigate }: { kind: AdminSectionKind; query: string; onNavigate: (path: string) => void }) {
  const copy = titles[kind];
  return <div className="section-page-header"><div><div className="section-kicker plain">{copy.eyebrow}</div><h1>{copy.title}</h1><p>{copy.description}</p>{query && <span className="route-query">Filtered by <strong>{query}</strong></span>}</div><div className="section-header-actions"><button type="button" className="ghost-button" onClick={() => onNavigate(ADMIN_ROUTES.dashboard)}>Back to overview <ArrowUpRight size={15} /></button>{kind === 'tournaments' && <button type="button" className="primary-button" onClick={() => onNavigate('/tournaments/create')}><Trophy size={15} /> Create tournament</button>}{kind === 'auctions' && <button type="button" className="primary-button" onClick={() => onNavigate(`${ADMIN_ROUTES.auctions}?status=LIVE`)}><Gavel size={15} /> Monitor live floor</button>}</div></div>;
}

function StatusTable({ title, map, color = '#a3e635' }: { title: string; map: Record<string, number>; color?: string }) {
  const rows = statusRows(map);
  const max = Math.max(...rows.map(([, value]) => value), 1);
  return <section className="section-card status-table-card"><div className="section-card-header"><div><span className="section-card-kicker"><Activity size={13} /> Live aggregate</span><h2>{title}</h2></div><span className="table-total">{formatCount(rows.reduce((sum, [, value]) => sum + value, 0))} records</span></div><div className="status-table">{rows.map(([status, value]) => <div className="status-table-row" key={status}><span className="status-table-name"><i style={{ background: status === 'UNKNOWN' ? '#fb7185' : color }} />{status === 'UNKNOWN' ? 'Unrecognized status' : toTitleCase(status)}</span><span className="status-table-track"><i style={{ width: `${value ? Math.max((value / max) * 100, 5) : 0}%`, background: status === 'UNKNOWN' ? '#fb7185' : color }} /></span><strong>{formatCount(value)}</strong></div>)}</div></section>;
}

function BoundaryCard({ icon: Icon, eyebrow, title, body, action, onNavigate }: { icon: ComponentType<LucideProps>; eyebrow: string; title: string; body: string; action?: string; onNavigate: (path: string) => void }) {
  return <section className="boundary-card"><span className="boundary-icon"><Icon size={18} /></span><span><small>{eyebrow}</small><strong>{title}</strong><p>{body}</p>{action && <button type="button" onClick={() => onNavigate(action)}>Open connected workspace <ArrowUpRight size={14} /></button>}</span></section>;
}

function OverviewSectionContent({ kind, overview, query, onNavigate, identity }: { kind: AdminSectionKind; overview: AdminOverview; query: string; onNavigate: (path: string) => void; identity: { name: string; role: string; initials: string } }) {
  if (kind === 'tournaments') return <><div className="section-metric-grid"><MetricCard icon={Trophy} label="Total tournaments" value={formatCount(overview.tournaments.total)} support={`${overview.tournaments.byStatus.UNKNOWN ?? 0} unrecognized statuses`} tone="lime" onOpen={() => onNavigate('/admin/data-quality?type=tournament-status')} /><MetricCard icon={Activity} label="Auction running" value={formatCount(overview.tournaments.byStatus.AUCTION_RUNNING)} support={`${formatCount(overview.tournaments.byStatus.AUCTION_SCHEDULED)} scheduled`} tone="blue" onOpen={() => onNavigate('/admin/tournaments?status=AUCTION_RUNNING')} /><MetricCard icon={CircleAlert} label="Cancelled" value={formatCount(overview.tournaments.byStatus.CANCELLED)} support="Lifecycle exceptions" tone="amber" onOpen={() => onNavigate('/admin/tournaments?status=CANCELLED')} /></div><StatusTable title="Tournament lifecycle distribution" map={overview.tournaments.byStatus} color="#60a5fa" /></>;
  if (kind === 'auctions') return <><div className="section-metric-grid"><MetricCard icon={Gavel} label="Auction rooms" value={formatCount(overview.auctions.total)} support={`${formatCount(overview.auctions.byStatus.COMPLETED)} completed`} tone="lime" /><MetricCard icon={Wifi} label="Live viewers" value={formatCount(overview.activity.activeAuctionViewers)} support={`${formatCount(overview.auctions.byStatus.PAUSED)} paused rooms`} tone="blue" /><MetricCard icon={CircleDollarSign} label="Auction value" value={formatRupees(overview.activity.totalSoldValue)} support={`${formatCount(overview.activity.totalBids)} bids`} tone="amber" /></div><StatusTable title="Auction room distribution" map={overview.auctions.byStatus} color="#a3e635" /><BoundaryCard icon={Gavel} eyebrow="Auction record details" title="Open a row to inspect its room state" body="Auction rows now include bid counts, active viewers, unresolved player counts, tournament context, and current lot state." action={ADMIN_ROUTES.auctions} onNavigate={onNavigate} /></>;
  if (kind === 'players') return <><div className="section-metric-grid"><MetricCard icon={Users} label="Player profiles" value={formatCount(overview.platform.players)} support={`${formatCount(overview.attention.pendingPlayerRegistrations)} registrations pending`} tone="lime" onOpen={() => onNavigate(`${ADMIN_ROUTES.attention}?type=players`)} /><MetricCard icon={CircleDollarSign} label="Players sold" value={formatCount(overview.activity.soldPlayers)} support={formatRupees(overview.activity.totalSoldValue)} tone="blue" /><MetricCard icon={CircleAlert} label="Unresolved players" value={formatCount(overview.attention.unresolvedAuctionPlayers)} support="Needs auction resolution" tone="amber" onOpen={() => onNavigate(`${ADMIN_ROUTES.attention}?type=unresolved`)} /></div><StatusTable title="Player lot-outcome distribution" map={overview.activity.playersByLotOutcome ?? {}} color="#a3e635" /></>;
  if (kind === 'franchises') return <><div className="section-metric-grid"><MetricCard icon={Building2} label="Franchises" value={formatCount(overview.platform.franchises)} support="Platform franchise profiles" tone="lime" /><MetricCard icon={Users} label="Pending team registrations" value={formatCount(overview.attention.pendingTeamRegistrations)} support="Approval queue" tone="violet" onOpen={() => onNavigate(`${ADMIN_ROUTES.attention}?type=teams`)} /><MetricCard icon={CircleDollarSign} label="Sold value" value={formatRupees(overview.activity.totalSoldValue)} support={`${formatCount(overview.activity.soldPlayers)} players sold`} tone="amber" /></div><BoundaryCard icon={Building2} eyebrow="Franchise records" title="Select a row to continue into franchise operations" body="The admin franchise directory is now server-paginated and returns owners, cities, active state, and public identity fields." action={ADMIN_ROUTES.franchises} onNavigate={onNavigate} /></>;
  if (kind === 'users') return <><div className="section-metric-grid"><MetricCard icon={Users} label="Users" value={formatCount(overview.platform.users)} support={`${formatCount(overview.platform.activeUsers)} active`} tone="lime" /><MetricCard icon={ShieldCheck} label="Organizers" value={formatCount(overview.platform.organizers)} support="Organizer accounts" tone="blue" /><MetricCard icon={Trophy} label="Tournaments" value={formatCount(overview.platform.tournaments)} support="Across platform" tone="violet" /></div><BoundaryCard icon={UserRound} eyebrow="User directory" title="Role-aware user records are now searchable" body="Use the table above to search by name/email and inspect role and active state. Detail commands will be added in the next moderation phase." action={ADMIN_ROUTES.users} onNavigate={onNavigate} /></>;
  if (kind === 'audit') return <RecentActivityPanel activities={overview.recentActivity} onAction={onNavigate} />;
  if (kind === 'attention') return <AttentionPanel overview={overview} onAction={onNavigate} />;
  if (kind === 'dataQuality') return <><div className="section-metric-grid"><MetricCard icon={Database} label="Unknown tournament states" value={formatCount(overview.tournaments.byStatus.UNKNOWN)} support="Records require review" tone="amber" /><MetricCard icon={CircleAlert} label="Sold-state mismatches" value={formatCount(overview.dataQuality?.soldStateMismatches)} support="isSold vs lotOutcome" tone="violet" /><MetricCard icon={CheckCircle2} label="Known status coverage" value={`${overview.tournaments.byStatus.UNKNOWN ? 'Needs review' : 'Clean'}`} support="Enum reconciliation" tone="lime" /></div><StatusTable title="Tournament status reconciliation" map={overview.tournaments.byStatus} color="#8b7cf6" /><BoundaryCard icon={Database} eyebrow="Integrity workflow" title="Reconciliation actions should be auditable" body="Keep these records read-only in the overview. Any repair action should be implemented as an explicit admin command with an audit event." action={ADMIN_ROUTES.audit} onNavigate={onNavigate} /></>;
  if (kind === 'analytics') return <><div className="section-metric-grid"><MetricCard icon={Activity} label="Total bids" value={formatCount(overview.activity.totalBids)} support="Snapshot total" tone="blue" /><MetricCard icon={CircleDollarSign} label="Sold value" value={formatRupees(overview.activity.totalSoldValue)} support="Snapshot total" tone="lime" /><MetricCard icon={Eye} label="Viewers now" value={formatCount(overview.activity.activeAuctionViewers)} support="Live/paused rooms" tone="violet" /></div><BoundaryCard icon={Activity} eyebrow="Historical analytics" title="The overview is a point-in-time read model" body="Add a time-series endpoint for bid velocity, GMV, sell-through, and viewer history. This page will consume it without changing the overview contract." onNavigate={onNavigate} /></>;
  if (kind === 'search') return <><BoundaryCard icon={Users} eyebrow="Global search" title={query ? `Search results for “${query}”` : 'Start with a search term'} body="Use the resource directories above for server-side search across users, tournaments, players, franchises, and auctions." action={ADMIN_ROUTES.users} onNavigate={onNavigate} /><div className="search-shortcuts"><button type="button" onClick={() => onNavigate(ADMIN_ROUTES.tournaments)}>Search tournaments <ArrowUpRight size={14} /></button><button type="button" onClick={() => onNavigate(ADMIN_ROUTES.players)}>Search players <ArrowUpRight size={14} /></button><button type="button" onClick={() => onNavigate(ADMIN_ROUTES.auctions)}>Search auctions <ArrowUpRight size={14} /></button></div></>;
  if (kind === 'settings') return <><div className="settings-card"><div className="settings-identity"><div className="settings-avatar">{identity.initials}</div><div><span>Authenticated administrator</span><h2>{identity.name}</h2><strong>{identity.role}</strong></div></div><div className="settings-row"><span>Access boundary</span><b>ADMIN</b></div><div className="settings-row"><span>Overview endpoint</span><b>/api/v1/admin/dashboard/overview</b></div><div className="settings-row"><span>Session mode</span><b className="green-text">Authenticated</b></div></div><BoundaryCard icon={ShieldCheck} eyebrow="Security" title="Role enforcement stays at the route boundary" body="Keep AdminRoute and the backend requireAdmin middleware as the authoritative access controls." action={ADMIN_ROUTES.systemHealth} onNavigate={onNavigate} /></>;
  if (kind === 'systemHealth') return <><div className="health-status-card"><span className="health-status-icon"><Wifi size={21} /></span><div><span>Admin overview API</span><h2>Connected and responding</h2><p>Last server snapshot: {overview.meta?.generatedAt ? format(new Date(overview.meta.generatedAt), 'd MMM yyyy, h:mm a') : 'recently'}</p></div><CheckCircle2 size={21} /></div><BoundaryCard icon={ShieldCheck} eyebrow="Health boundary" title="System health metrics are now available" body="Use the system-health endpoint to inspect database readiness, ping latency, process uptime, and memory RSS." action={ADMIN_ROUTES.systemHealth} onNavigate={onNavigate} /></>;
  if (kind === 'notifications') return <BoundaryCard icon={Bell} eyebrow="Notification center" title="Open the existing user notification workspace" body="Notification delivery status is not part of the admin overview contract. Use the existing notification route for inbox actions." action="/notifications" onNavigate={onNavigate} />;
  return null;
}

export function AdminSectionPage({ kind }: { kind: AdminSectionKind }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: overview, isLoading, isFetching, isError, refetch } = useAdminDashboard();
  const resourceKind = resourceBySection[kind];
  const queryParams = useMemo<ResourceQuery>(() => {
    const page = Number(searchParams.get('page') ?? 1);
    return {
      page: Number.isFinite(page) && page > 0 ? page : 1,
      limit: 10,
      search: searchParams.get('q') ?? undefined,
      status: searchParams.get('status') ?? undefined,
      action: searchParams.get('action') ?? undefined,
    };
  }, [location.search]);
  const resourceQueryKind: AdminResourceKind = resourceKind ?? 'users';
  const resourceQuery = useAdminResourceList(resourceQueryKind, queryParams, Boolean(resourceKind));
  const queryLabel = searchParams.get('q') ?? searchParams.get('status') ?? searchParams.get('type') ?? '';
  const generatedAt = overview?.meta?.generatedAt ? new Date(overview.meta.generatedAt) : null;
  const syncDate = generatedAt && !Number.isNaN(generatedAt.getTime()) ? generatedAt : new Date();

  const updateResourceQuery = (next: ResourceQuery) => {
    const nextParams = new URLSearchParams();
    if (next.search) nextParams.set('q', next.search);
    if (next.status) nextParams.set('status', next.status);
    if (next.action) nextParams.set('action', next.action);
    if (next.page && next.page > 1) nextParams.set('page', String(next.page));
    setSearchParams(nextParams);
  };

  const refreshAll = async () => {
    await Promise.all([refetch(), resourceKind ? resourceQuery.refetch() : Promise.resolve()]);
  };

  return <AdminLayout lastSync={syncDate} isFetching={isFetching || resourceQuery.isFetching} onRefresh={refreshAll}>{({ navigateTo, identity }) => <div className="dashboard-content section-page-content"><SectionHeader kind={kind} query={queryLabel} onNavigate={navigateTo} />{isLoading && <OverviewSkeleton />}{!isLoading && isError && <OverviewErrorState onRetry={() => refetch()} />}{!isLoading && !isError && overview && <>{resourceKind && <AdminResourceTable kind={resourceKind} rows={(resourceQuery.data?.data ?? []) as AdminResource[]} pagination={resourceQuery.data?.pagination ?? resourceQuery.data?.meta} query={queryParams} isLoading={resourceQuery.isLoading} onQueryChange={updateResourceQuery} onNavigate={navigateTo} />}<OverviewSectionContent kind={kind} overview={overview} query={queryLabel} onNavigate={navigateTo} identity={identity} /></>}</div>}</AdminLayout>;
}
