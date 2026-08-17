import {
  Building2,
  ChevronDown,
  Gauge,
  Gavel,
  LayoutDashboard,
  ListFilter,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShieldCheck,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';
import type { AdminIdentity } from '@/hooks/useAdminIdentity';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';

type IconType = ComponentType<LucideProps>;

type NavItem = {
  label: string;
  icon: IconType;
  path: string;
  badge?: string;
};

const primaryNav: NavItem[] = [
  { label: 'Overview', icon: LayoutDashboard, path: ADMIN_ROUTES.dashboard },
  { label: 'Tournaments', icon: Trophy, path: ADMIN_ROUTES.tournaments },
  { label: 'Auctions', icon: Gavel, path: ADMIN_ROUTES.auctions },
  { label: 'Players', icon: Users, path: ADMIN_ROUTES.players },
  { label: 'Franchises', icon: Building2, path: ADMIN_ROUTES.franchises },
];

const operationsNav: NavItem[] = [
  { label: 'Users & roles', icon: UserRound, path: ADMIN_ROUTES.users },
  { label: 'Audit log', icon: ListFilter, path: ADMIN_ROUTES.audit },
  { label: 'System health', icon: Gauge, path: ADMIN_ROUTES.systemHealth },
];

export function AdminSidebar({
  collapsed,
  mobileOpen,
  activeNav,
  identity,
  onToggle,
  onNavigate,
  onCloseMobile,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  activeNav: string;
  identity: AdminIdentity;
  onToggle: () => void;
  onNavigate: (path: string) => void;
  onCloseMobile: () => void;
}) {
  const renderNav = (items: NavItem[]) => (
    <div className="nav-list">
      {items.map((item) => {
        const active = activeNav === item.label;
        const Icon = item.icon;
        return (
          <button
            type="button"
            key={item.label}
            className={`nav-item ${active ? 'is-active' : ''}`}
            onClick={() => { onNavigate(item.path); onCloseMobile(); }}
            title={collapsed ? item.label : undefined}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span className="nav-label">{item.label}</span>
            {item.badge && <span className="nav-badge">{item.badge}</span>}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={onCloseMobile} />}
      <aside className={`sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><span>GB</span><i /></div>
          <div className="brand-copy"><strong>Gully<span>Bid</span></strong><small>Admin command center</small></div>
          <button className="mobile-close" type="button" onClick={onCloseMobile} aria-label="Close navigation"><X size={19} /></button>
        </div>

        <button type="button" className="workspace-switcher" onClick={() => onNavigate(ADMIN_ROUTES.dashboard)}>
          <div className="workspace-avatar">G</div>
          <div className="workspace-copy"><span>Workspace</span><strong>GullyBid India</strong></div>
          <ChevronDown size={15} />
        </button>

        <div className="nav-section"><span className="nav-heading">Command center</span>{renderNav(primaryNav)}</div>
        <div className="nav-section nav-section-spaced"><span className="nav-heading">Operations</span>{renderNav(operationsNav)}</div>

        <div className="sidebar-bottom">
          <div className="sidebar-health">
            <span className="health-icon"><ShieldCheck size={16} /></span>
            <div className="health-copy"><span>Platform status</span><strong><i className="status-dot" /> API connected</strong></div>
            <span className="health-ping" />
          </div>
          <button type="button" className={`nav-item settings-item ${activeNav === 'Settings' ? 'is-active' : ''}`} onClick={() => onNavigate(ADMIN_ROUTES.settings)}>
            <Settings2 size={18} strokeWidth={1.8} /><span className="nav-label">Settings</span>
          </button>
          <div className="sidebar-footer-line" />
          <div className="sidebar-user">
            <div className="user-avatar">{identity.initials}</div>
            <div className="user-copy"><strong>{identity.name}</strong><span>{identity.role === 'ADMIN' ? 'Super administrator' : identity.role}</span></div>
            <MoreHorizontal size={17} />
          </div>
        </div>

        <button className="collapse-button" type="button" onClick={onToggle} aria-label="Toggle sidebar">
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          <span>{collapsed ? 'Expand' : 'Collapse'} sidebar</span>
        </button>
      </aside>
    </>
  );
}
