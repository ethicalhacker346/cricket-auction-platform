import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { formatActivityTime, formatCount, formatExactDate, toTitleCase } from '@/lib/formatters';
import type { PaginationMeta, AdminResource, AdminResourceKind, AdminUser, AdminTournament, AdminPlayer, AdminFranchise, AdminAuction, AdminAuditLog, ResourceQuery } from '@/types/adminResources';

function pageCount(pagination?: PaginationMeta) {
  if (!pagination) return 1;
  return pagination.pages ?? pagination.totalPages ?? Math.max(Math.ceil(pagination.total / pagination.limit), 1);
}

function rowId(row: AdminResource) {
  return row.id;
}

function renderCells(kind: AdminResourceKind, row: AdminResource) {
  if (kind === 'users') {
    const item = row as AdminUser;
    const displayName = item.name ?? item.email ?? 'Unknown';
    const initials = displayName.slice(0, 2).toUpperCase();
    return (
      <>
        <td>
          <div className="resource-primary">
            <span className="table-avatar">{initials}</span>
            <span>
              <strong>{displayName}</strong>
              <small>{item.email ?? '—'}</small>
            </span>
          </div>
        </td>
        <td><span className="resource-pill">{item.role ?? '—'}</span></td>
        <td>
          <span className={`state-pill ${item.isActive ? 'positive' : 'muted'}`}>
            {item.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>{item.lastLoginAt ? formatActivityTime(item.lastLoginAt) : 'Never'}</td>
      </>
    );
  }

  if (kind === 'tournaments') {
    const item = row as AdminTournament;
    const displayName = item.name ?? 'Unnamed';
    return (
      <>
        <td>
          <div className="resource-primary">
            <span className="resource-emblem">T</span>
            <span>
              <strong>{displayName}</strong>
              <small>{item.season || item.slug || '—'}</small>
            </span>
          </div>
        </td>
        <td>
          <span className="status-text">
            {item.status === 'UNKNOWN' ? 'Unrecognized status' : toTitleCase(item.status)}
          </span>
        </td>
        <td>{item.organizer?.name ?? 'Unassigned'}</td>
        <td>{item.auctionDate ? formatExactDate(item.auctionDate) : 'Not scheduled'}</td>
      </>
    );
  }

  if (kind === 'players') {
    const item = row as AdminPlayer;
    const displayName = item.fullName ?? item.user?.email ?? 'Unknown';
    const initials = displayName.slice(0, 2).toUpperCase();
    return (
      <>
        <td>
          <div className="resource-primary">
            <span className="table-avatar player-avatar">{initials}</span>
            <span>
              <strong>{displayName}</strong>
              <small>{item.user?.email ?? 'No linked account'}</small>
            </span>
          </div>
        </td>
        <td><span className="resource-pill">{toTitleCase(item.primaryRole)}</span></td>
        <td>{item.nationality || '—'}</td>
        <td>
          <span className={`state-pill ${item.isActive ? 'positive' : 'muted'}`}>
            {item.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
      </>
    );
  }

  if (kind === 'franchises') {
    const item = row as AdminFranchise;
    const displayName = item.name ?? 'Unnamed';
    return (
      <>
        <td>
          <div className="resource-primary">
            <span className="resource-emblem franchise-emblem">F</span>
            <span>
              <strong>{displayName}</strong>
              <small>{item.slug ?? '—'}</small>
            </span>
          </div>
        </td>
        <td>{item.city || '—'}</td>
        <td>{item.owner?.name ?? 'Unassigned'}</td>
        <td>
          <span className={`state-pill ${item.isActive ? 'positive' : 'muted'}`}>
            {item.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
      </>
    );
  }

  if (kind === 'auctions') {
    const item = row as AdminAuction;
    const displayName = item.name ?? 'Unnamed';
    return (
      <>
        <td>
          <div className="resource-primary">
            <span className="resource-emblem auction-emblem">A</span>
            <span>
              <strong>{displayName}</strong>
              <small>{item.tournament?.name ?? 'Unknown tournament'}</small>
            </span>
          </div>
        </td>
        <td><span className="status-text">{toTitleCase(item.status)}</span></td>
        <td>{formatCount(item.bidCount)}</td>
        <td>{formatCount(item.activeViewerCount)}</td>
        <td>
          {item.unresolvedPlayerCount > 0 ? (
            <span className="state-pill warning">{item.unresolvedPlayerCount} unresolved</span>
          ) : (
            <span className="state-pill positive">Clear</span>
          )}
        </td>
      </>
    );
  }

  const item = row as AdminAuditLog;
  return (
    <>
      <td><span className="resource-pill audit-action">{toTitleCase(item.action)}</span></td>
      <td>{item.tournamentName ?? 'Unknown tournament'}</td>
      <td><span className="audit-message">{item.message ?? '—'}</span></td>
      <td>{item.actor?.name ?? 'System'}</td>
      <td>{formatActivityTime(item.timestamp)}</td>
    </>
  );
}

const columns: Record<AdminResourceKind, string[]> = {
  users: ['User', 'Role', 'State', 'Last login'],
  tournaments: ['Tournament', 'Status', 'Organizer', 'Auction date'],
  players: ['Player', 'Role', 'Nationality', 'State'],
  franchises: ['Franchise', 'City', 'Owner', 'State'],
  auctions: ['Auction room', 'Status', 'Bids', 'Viewers', 'Lot health'],
  'audit-logs': ['Action', 'Tournament', 'Activity', 'Actor', 'When'],
};

export function AdminResourceTable({ kind, rows, pagination, query, isLoading, onQueryChange, onNavigate }: { kind: AdminResourceKind; rows: AdminResource[]; pagination?: PaginationMeta; query: ResourceQuery; isLoading: boolean; onQueryChange: (next: ResourceQuery) => void; onNavigate: (path: string) => void }) {
  const [search, setSearch] = useState(query.search ?? '');
  useEffect(() => setSearch(query.search ?? ''), [query.search]);
  const currentPage = pagination?.page ?? query.page ?? 1;
  const pages = pageCount(pagination);
  const total = pagination?.total ?? rows.length;

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    onQueryChange({ ...query, search: search.trim() || undefined, page: 1 });
  };
  const changePage = (page: number) => onQueryChange({ ...query, page: Math.min(Math.max(page, 1), pages) });

  return <section className="resource-table-card section-card"><div className="resource-table-toolbar"><div><span className="section-card-kicker"><SlidersHorizontal size={13} /> Admin directory</span><h2>{toTitleCase(kind)} records</h2><small>{formatCount(total)} records · server-side pagination</small></div><form className="resource-search" onSubmit={submitSearch}><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${kind.replace('-', ' ')}...`} /><button type="submit">Search</button></form></div><div className="resource-table-wrap"><table className="resource-table"><thead><tr>{columns[kind].map((column) => <th key={column}>{column}</th>)}<th /></tr></thead><tbody>{isLoading && <tr><td colSpan={columns[kind].length + 1}><div className="resource-loading">Loading live records…</div></td></tr>}{!isLoading && rows.length === 0 && <tr><td colSpan={columns[kind].length + 1}><div className="resource-empty"><Search size={18} /><strong>No records matched this filter</strong><span>Try a broader search or reset the current query.</span></div></td></tr>}{!isLoading && rows.map((row) => <tr key={rowId(row)} onClick={() => onNavigate(`/admin/${kind}?selected=${encodeURIComponent(rowId(row))}`)}>{renderCells(kind, row)}<td><button type="button" className="resource-open" onClick={(event) => { event.stopPropagation(); onNavigate(`/admin/${kind}?selected=${encodeURIComponent(rowId(row))}`); }}><ArrowRightIcon /></button></td></tr>)}</tbody></table></div><div className="resource-pagination"><span>Page {currentPage} of {pages}</span><div><button type="button" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)} aria-label="Previous page"><ArrowLeft size={14} /></button><button type="button" disabled={currentPage >= pages} onClick={() => changePage(currentPage + 1)} aria-label="Next page"><ArrowRight size={14} /></button></div></div></section>;
}

function ArrowRightIcon() { return <ArrowRight size={15} />; }