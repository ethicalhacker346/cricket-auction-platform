import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';
import { NotificationToast } from '@/components/admindashboard/NotificationToast';
import { useAdminIdentity, type AdminIdentity } from '@/hooks/useAdminIdentity';
import { getAdminNavLabel } from '@/lib/adminRoutes';

export interface AdminLayoutContext {
  navigateTo: (path: string) => void;
  notify: (message: string) => void;
  identity: AdminIdentity;
}

export function AdminLayout({
  children,
  lastSync = new Date(),
  isFetching = false,
  onRefresh,
}: {
  children: (context: AdminLayoutContext) => ReactNode;
  lastSync?: Date;
  isFetching?: boolean;
  onRefresh?: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const identity = useAdminIdentity();

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3200);
  };

  const navigateTo = (path: string) => navigate(path);
  const handleNavigate = (path: string) => navigateTo(path);

  return (
    <div className="app-shell">
      <AdminSidebar collapsed={collapsed} mobileOpen={mobileOpen} activeNav={getAdminNavLabel(location.pathname)} identity={identity} onToggle={() => setCollapsed((value) => !value)} onNavigate={handleNavigate} onCloseMobile={() => setMobileOpen(false)} />
      <main className={`main-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <AdminTopbar identity={identity} onOpenMobile={() => setMobileOpen(true)} onRefresh={onRefresh ?? (() => undefined)} isFetching={isFetching} lastSync={lastSync} onNotify={notify} onNavigate={navigateTo} />
        {children({ navigateTo, notify, identity })}
      </main>
      {notice && <NotificationToast message={notice} onDismiss={() => setNotice(null)} />}
    </div>
  );
}