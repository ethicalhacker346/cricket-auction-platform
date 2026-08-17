import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, CalendarDays, CheckCircle2, ChevronDown, Menu, RefreshCw, Search, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { AdminIdentity } from '@/hooks/useAdminIdentity';
import { ADMIN_ROUTES, getAdminNavLabel } from '@/lib/adminRoutes';

export function AdminTopbar({
  identity,
  onOpenMobile,
  onRefresh,
  isFetching,
  lastSync,
  onNotify,
  onNavigate,
}: {
  identity: AdminIdentity;
  onOpenMobile: () => void;
  onRefresh: () => void;
  isFetching: boolean;
  lastSync: Date;
  onNotify: (message: string) => void;
  onNavigate: (path: string) => void;
}) {
  const location = useLocation();
  const currentLabel = getAdminNavLabel(location.pathname);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [range, setRange] = useState('Overview');

  const submitSearch = () => {
    const query = search.trim();
    if (!query) return;
    onNavigate(`${ADMIN_ROUTES.search}?q=${encodeURIComponent(query)}`);
    setSearchOpen(false);
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="mobile-menu" type="button" onClick={onOpenMobile} aria-label="Open navigation"><Menu size={21} /></button>
        <div className="breadcrumb"><span>Control room</span><b>/</b><strong>{currentLabel}</strong></div>
      </div>
      <div className="topbar-right">
        <div className={`global-search ${searchOpen ? 'is-open' : ''}`}>
          {searchOpen && <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') submitSearch(); }} placeholder="Search users, tournaments..." aria-label="Search admin workspace" />}
          <button type="button" aria-label="Search" onClick={() => { if (searchOpen && search.trim()) submitSearch(); else setSearchOpen((open) => !open); }}>{searchOpen ? <X size={18} /> : <Search size={18} />}</button>
        </div>
        <div className="range-wrap">
          <button className="range-button" type="button" onClick={() => setRangeOpen((open) => !open)}><CalendarDays size={16} /><span>{range}</span><ChevronDown size={14} /></button>
          {rangeOpen && <div className="popover range-popover">
            {['Overview', 'Analytics', 'Attention'].map((option) => <button type="button" key={option} className={range === option ? 'selected' : ''} onClick={() => { setRange(option); setRangeOpen(false); if (option === 'Analytics') onNavigate(ADMIN_ROUTES.analytics); else if (option === 'Attention') onNavigate(ADMIN_ROUTES.attention); else onNavigate(ADMIN_ROUTES.dashboard); }}>{option}{range === option && <CheckCircle2 size={14} />}</button>)}
          </div>}
        </div>
        <div className="sync-meta"><span className="sync-dot" /><span>Synced {formatDistanceToNow(lastSync, { addSuffix: true })}</span></div>
        <button className={`icon-button refresh-button ${isFetching ? 'is-spinning' : ''}`} type="button" onClick={onRefresh} aria-label="Refresh dashboard"><RefreshCw size={17} /></button>
        <button className="icon-button notification-button" type="button" onClick={() => onNavigate('/notifications')} aria-label="Notifications"><Bell size={18} /><span /></button>
        <button className="topbar-avatar" type="button" onClick={() => onNavigate(ADMIN_ROUTES.settings)} aria-label="Open account settings">{identity.initials}</button>
      </div>
    </header>
  );
}