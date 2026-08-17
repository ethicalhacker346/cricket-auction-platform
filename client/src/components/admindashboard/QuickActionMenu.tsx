import { AlertTriangle, ArrowRight, Command, Gavel, Plus } from 'lucide-react';
import { ADMIN_ROUTES } from '@/lib/adminRoutes';

export function QuickActionMenu({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="quick-menu popover">
      <div className="quick-menu-heading"><span>Quick actions</span><Command size={14} /></div>
      <button type="button" onClick={() => onNavigate('/tournaments/create')}><span className="quick-icon lime"><Plus size={16} /></span><span><strong>New tournament</strong><small>Set up the next season</small></span><ArrowRight size={15} /></button>
      <button type="button" onClick={() => onNavigate(ADMIN_ROUTES.auctions)}><span className="quick-icon blue"><Gavel size={16} /></span><span><strong>Manage auctions</strong><small>Open the auction workspace</small></span><ArrowRight size={15} /></button>
      <button type="button" onClick={() => onNavigate(ADMIN_ROUTES.attention)}><span className="quick-icon amber"><AlertTriangle size={16} /></span><span><strong>Review queue</strong><small>Open pending registrations</small></span><ArrowRight size={15} /></button>
    </div>
  );
}

