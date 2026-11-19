import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuctionPermissions } from '../hooks/index.hook';
import { useAuctionContext } from '../hooks/useAuctionContext';
import { AuctionRoutes } from './auction.routes';

/** Public viewing never implies access to management or an owner's console. */
export function AuctionAccessRoute({ access, children }: { access: 'manage' | 'team'; children: ReactNode }) {
  const { auctionId, tournamentId } = useAuctionContext();
  const permissions = useAuctionPermissions(auctionId);
  if (permissions.loading) return <div role="status" className="flex justify-center py-20 text-slate-400"><Loader2 aria-label="Checking access" className="h-6 w-6 animate-spin" /></div>;
  const allowed = permissions.authenticated && (access === 'manage'
    ? permissions.ownsAuction || permissions.ownsTournament || permissions.role === 'ADMIN'
    : permissions.ownsTournamentTeam);
  return allowed ? <>{children}</> : <Navigate to={AuctionRoutes.live(tournamentId, auctionId)} replace />;
}
