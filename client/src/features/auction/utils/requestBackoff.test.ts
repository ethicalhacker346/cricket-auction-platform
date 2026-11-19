import { afterEach, describe, expect, it, vi } from 'vitest';
import { auctionCommandId, parseRetryAfter, requestBackoffMs } from './requestBackoff';

afterEach(() => vi.unstubAllGlobals());
describe('auction request backoff', () => {
  it('reads seconds and HTTP-date, including a body fallback', () => {
    const now = Date.parse('2026-11-18T10:00:00Z');
    expect(parseRetryAfter('12', undefined, now)).toBe(12_000);
    expect(parseRetryAfter('Wed, 18 Nov 2026 10:00:30 GMT', undefined, now)).toBe(30_000);
    expect(parseRetryAfter('unusable', 7, now)).toBe(7000);
    expect(parseRetryAfter(null, 5, now)).toBe(5000);
    expect(parseRetryAfter('0')).toBe(1000);
  });
  it('bounds malformed, negative, infinite and excessively long retry values', () => {
    for (const value of ['', 'not a date', '-2', 'Infinity']) expect(parseRetryAfter(value)).toBeUndefined();
    expect(parseRetryAfter(null, NaN)).toBeUndefined();
    expect(parseRetryAfter(null, -1)).toBeUndefined();
    expect(parseRetryAfter('999999999')).toBe(3_600_000);
    expect(parseRetryAfter('Fri, 01 Jan 1999 00:00:00 GMT')).toBeUndefined();
  });
  it('uses capped exponential backoff and respects a longer Retry-After', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(requestBackoffMs({}, 1)).toBe(10_000);
    expect(requestBackoffMs({}, 2)).toBe(20_000);
    expect(requestBackoffMs({}, 100)).toBe(120_000);
    expect(requestBackoffMs({ retryAfterMs: 300_000 }, 1)).toBe(300_000);
    expect(requestBackoffMs({ retryAfterMs: NaN }, 1)).toBe(10_000);
  });
  it('creates UUID command identities, including without randomUUID', () => {
    expect(auctionCommandId()).toMatch(/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i);
    const getRandomValues = vi.fn((bytes: Uint8Array) => { bytes[0] = 11; return bytes; });
    vi.stubGlobal('crypto', { getRandomValues });
    expect(auctionCommandId()).toMatch(/^bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb$/);
    expect(getRandomValues).toHaveBeenCalled();
  });
});
