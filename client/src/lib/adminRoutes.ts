export const ADMIN_ROUTES = {
  dashboard: '/admin/dashboard',
  tournaments: '/admin/tournaments',
  auctions: '/admin/auctions',
  players: '/admin/players',
  franchises: '/admin/franchises',
  users: '/admin/users',
  audit: '/admin/audit-logs',
  systemHealth: '/admin/system-health',
  settings: '/admin/settings',
  attention: '/admin/attention',
  dataQuality: '/admin/data-quality',
  analytics: '/admin/analytics',
  search: '/admin/search',
} as const;

export type AdminRoutePath = typeof ADMIN_ROUTES[keyof typeof ADMIN_ROUTES];

export function getAdminNavLabel(pathname: string) {
  if (pathname === ADMIN_ROUTES.dashboard) return 'Overview';
  if (pathname.startsWith(ADMIN_ROUTES.tournaments)) return 'Tournaments';
  if (pathname.startsWith(ADMIN_ROUTES.auctions)) return 'Auctions';
  if (pathname.startsWith(ADMIN_ROUTES.players)) return 'Players';
  if (pathname.startsWith(ADMIN_ROUTES.franchises)) return 'Franchises';
  if (pathname.startsWith(ADMIN_ROUTES.users)) return 'Users & roles';
  if (pathname.startsWith(ADMIN_ROUTES.audit)) return 'Audit log';
  if (pathname.startsWith(ADMIN_ROUTES.systemHealth)) return 'System health';
  if (pathname.startsWith(ADMIN_ROUTES.settings)) return 'Settings';
  if (pathname.startsWith(ADMIN_ROUTES.attention)) return 'Attention center';
  if (pathname.startsWith(ADMIN_ROUTES.dataQuality)) return 'Data quality';
  if (pathname.startsWith(ADMIN_ROUTES.analytics)) return 'Analytics';
  if (pathname.startsWith(ADMIN_ROUTES.search)) return 'Search';
  return 'Overview';
}
