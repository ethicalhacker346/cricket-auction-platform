const PROFILE_HOSTS = new Set(['cricheroes.com', 'www.cricheroes.com', 'cricheroes.in', 'www.cricheroes.in']);

/** Matches the API allowlist; never render arbitrary user-supplied hrefs. */
export function normalizeCricHeroesUrl(value?: string | null): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input || input.length > 500 || /[\s\u0000-\u001f\u007f]/u.test(input)) return null;
  try {
    const url = new URL(input);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    const profile = PROFILE_HOSTS.has(url.hostname) && /^\/player-profile\/\d+(?:\/[^\s]*)?\/?$/i.test(url.pathname);
    const shared = url.hostname === 'cricheroes.page.link' && /^\/[a-zA-Z0-9_-]+\/?$/.test(url.pathname) && !url.search;
    if (!profile && !shared) return null;
    url.protocol = 'https:';
    url.hash = '';
    return url.toString();
  } catch { return null; }
}
