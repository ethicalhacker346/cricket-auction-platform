const VIEWER_ID_STORAGE_KEY = 'auction_viewer_id';
let fallback: string | null = null;

/** One opaque identity per browser tab, shared by socket and REST presence. */
export function getAuctionViewerId(): string {
  try {
    const stored = sessionStorage.getItem(VIEWER_ID_STORAGE_KEY);
    if (stored) return stored;
  } catch { /* Private/embedded browsers may deny sessionStorage. */ }
  const id = fallback ?? `viewer:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  fallback = id;
  try { sessionStorage.setItem(VIEWER_ID_STORAGE_KEY, id); } catch { /* In-memory identity still works. */ }
  return id;
}
