/** Same-origin development works in local browsers and proxied live previews. */
const PRODUCTION_API = 'https://gullybid-api.up.railway.app';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
  || (import.meta.env.DEV ? '/api/v1' : `${PRODUCTION_API}/api/v1`);
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  || (import.meta.env.DEV && typeof window !== 'undefined' ? window.location.origin : PRODUCTION_API);
