const MAX_RETRY_MS = 60 * 60_000;

/** Accept Retry-After seconds or HTTP-date; never turn malformed input into a spin loop. */
export function parseRetryAfter(header?: string | null, bodySeconds?: unknown, now = Date.now()): number | undefined {
  let milliseconds: number | undefined;
  if (header?.trim()) {
    const seconds = Number(header);
    milliseconds = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(header) - now;
  }
  if ((!Number.isFinite(milliseconds) || milliseconds! < 0) && typeof bodySeconds === 'number') milliseconds = bodySeconds * 1000;
  return Number.isFinite(milliseconds) && milliseconds! >= 0
    ? Math.max(1000, Math.min(MAX_RETRY_MS, milliseconds!)) : undefined;
}

export function requestBackoffMs(error: unknown, failures: number): number {
  const retryAfter = (error as { retryAfterMs?: number })?.retryAfterMs;
  const exponential = Math.min(120_000, 10_000 * 2 ** Math.min(4, Math.max(0, failures - 1)));
  return Math.max(exponential, Number.isFinite(retryAfter) ? retryAfter! : 0) + Math.floor(Math.random() * 1000);
}

/** A collision-resistant command ID, with a fallback for older embedded browsers. */
export function auctionCommandId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const number = globalThis.crypto?.getRandomValues
      ? globalThis.crypto.getRandomValues(new Uint8Array(1))[0] & 15 : Math.floor(Math.random() * 16);
    return (character === 'x' ? number : (number & 3) | 8).toString(16);
  });
}
