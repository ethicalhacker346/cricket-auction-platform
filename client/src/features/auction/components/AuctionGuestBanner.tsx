import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, Eye, Share2 } from 'lucide-react';
import { useAuth } from '../hooks/index.hook';
import { AuctionRoutes } from '../routes/auction.routes';

export function AuctionGuestBanner({ tournamentId, auctionId }: { tournamentId: string; auctionId: string }) {
  const { isAuthenticated, hasHydrated } = useAuth();
  const location = useLocation();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const share = async () => {
    const url = new URL(AuctionRoutes.live(tournamentId, auctionId), window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState('copied');
    } catch { setCopyState('error'); }
  };
  if (!hasHydrated) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-white/5 bg-sky-400/[0.04] px-4 py-2.5 text-xs sm:px-6">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-slate-400">
        <Eye className="h-3.5 w-3.5 text-sky-300" aria-hidden="true" />
        <span>{isAuthenticated ? 'Anyone with the watch link can spectate.' : <><strong className="text-sky-200">Guest view · read-only.</strong> No account needed to watch.</>}</span>
        {!isAuthenticated && <Link to="/login" state={{ from: location }} className="font-semibold text-slate-200 underline decoration-white/20 underline-offset-4 hover:text-white">Sign in to participate</Link>}
      </div>
      <div className="flex items-center gap-2">
        {copyState === 'error' && <span role="status" className="text-amber-200">Copy this page’s URL to share.</span>}
        <button type="button" onClick={() => void share()} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-semibold text-sky-200 hover:bg-sky-300/10 focus-visible:ring-2 focus-visible:ring-sky-200">
          {copyState === 'copied' ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
          <span role="status">{copyState === 'copied' ? 'Watch link copied' : 'Share watch link'}</span>
        </button>
      </div>
    </div>
  );
}
