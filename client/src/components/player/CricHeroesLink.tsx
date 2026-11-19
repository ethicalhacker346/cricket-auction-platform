import { ExternalLink } from 'lucide-react';
import { normalizeCricHeroesUrl } from '@/lib/cricheroes';
import { cn } from '@/lib/utils';

export function CricHeroesLink({ url, playerName, className }: {
  url?: string | null;
  playerName?: string;
  className?: string;
}) {
  const href = normalizeCricHeroesUrl(url);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${playerName ? `${playerName}'s ` : ''}CricHeroes profile (opens in a new tab)`}
      onClick={(event) => event.stopPropagation()}
      className={cn('inline-flex min-h-8 w-fit shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/10 hover:text-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400', className)}
    >
      CricHeroes <ExternalLink aria-hidden="true" className="h-3 w-3" />
    </a>
  );
}
