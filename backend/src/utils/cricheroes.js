const PROFILE_HOSTS = new Set(['cricheroes.com', 'www.cricheroes.com', 'cricheroes.in', 'www.cricheroes.in']);

/** No fetching/embeds: this is an optional outbound profile link, not verified stats. */
export function normalizeCricHeroesUrl(value) {
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
