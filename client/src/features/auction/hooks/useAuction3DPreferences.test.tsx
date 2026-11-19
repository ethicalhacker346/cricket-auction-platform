import { StrictMode } from 'react';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { supportsWebGL, useAuction3DPreferences } from './useAuction3DPreferences';

beforeEach(() => { vi.stubGlobal('navigator', { hardwareConcurrency: 8, deviceMemory: 8 }); });
afterEach(() => vi.unstubAllGlobals());
describe('3D viewer preferences', () => {
  it('defaults to Auto, respects legacy explicit quality, and persists only valid camera choices', () => {
    const hook = renderHook(useAuction3DPreferences);
    expect(hook.result.current.qualityPreference).toBe('auto'); expect(hook.result.current.quality).toBe('cinematic');
    act(() => hook.result.current.setQuality('balanced'));
    expect(localStorage.getItem('gullybid:auction-3d-quality')).toBe('balanced');
    act(() => hook.result.current.setCameraMode('top'));
    expect(localStorage.getItem('gullybid:auction-3d-camera')).toBe('top');
    hook.unmount();
    const again = renderHook(useAuction3DPreferences);
    expect(again.result.current.quality).toBe('balanced'); expect(again.result.current.cameraMode).toBe('top');
    act(() => again.result.current.setCameraMode('bad' as 'top'));
    expect(again.result.current.cameraMode).toBe('top');
  });
  it('samples once under StrictMode and adapts down without changing the saved Auto preference', () => {
    vi.useFakeTimers();
    const hook = renderHook(useAuction3DPreferences, { wrapper: StrictMode });
    act(() => hook.result.current.reportFrameRate(20));
    expect(hook.result.current.quality).toBe('cinematic');
    act(() => { vi.advanceTimersByTime(3000); hook.result.current.reportFrameRate(20); });
    expect(hook.result.current.quality).toBe('balanced');
    expect(hook.result.current.qualityPreference).toBe('auto');
    expect(localStorage.getItem('gullybid:auction-3d-quality')).toBeNull();
  });
  it('does not fight manual quality, background tabs, or a paused visual stage', () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    const hook = renderHook(useAuction3DPreferences);
    act(() => hook.result.current.setQuality('cinematic'));
    for (let i = 0; i < 4; i++) act(() => hook.result.current.reportFrameRate(10));
    expect(hook.result.current.quality).toBe('cinematic');
    act(() => hook.result.current.toggleMotion());
    act(() => hook.result.current.reportFrameRate(8));
    expect(hook.result.current.fps).toBe(10);
    visibility.mockReturnValue('hidden'); fireEvent(document, new Event('visibilitychange'));
    expect(hook.result.current.pageVisible).toBe(false);
    expect(localStorage.getItem('gullybid:auction-3d-motion-paused')).toBe('true');
  });
  it('uses nonpersistent safe quality after recovery and supports an explicit return to Auto', () => {
    const hook = renderHook(useAuction3DPreferences);
    act(() => hook.result.current.recoverRenderer());
    expect(hook.result.current.quality).toBe('performance'); expect(hook.result.current.recoveryMode).toBe(true);
    expect(hook.result.current.qualityPreference).toBe('auto');
    act(() => hook.result.current.setQuality('auto'));
    expect(hook.result.current.quality).toBe('cinematic'); expect(hook.result.current.recoveryMode).toBe(false);
  });
  it('honors the device reduced-motion setting and listens for a live preference change', () => {
    const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
    const original = window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation((query) => query.includes('prefers-reduced-motion') ? media as unknown as MediaQueryList : original(query));
    const hook = renderHook(useAuction3DPreferences);
    expect(hook.result.current.reducedMotion).toBe(true);
    act(() => hook.result.current.reportFrameRate(10));
    expect(hook.result.current.fps).toBeNull();
    media.matches = false;
    act(() => media.addEventListener.mock.calls[0][1]());
    expect(hook.result.current.reducedMotion).toBe(false);
    hook.unmount(); expect(media.removeEventListener).toHaveBeenCalled();
  });
  it('keeps in-session controls working when storage is denied and synchronizes other tabs', () => {
    const get = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    const hook = renderHook(useAuction3DPreferences);
    act(() => hook.result.current.setQuality('performance'));
    act(() => hook.result.current.setFollowBids(false));
    expect(hook.result.current.quality).toBe('performance'); expect(hook.result.current.followBids).toBe(false);
    get.mockReturnValue('stage');
    fireEvent(window, new StorageEvent('storage', { key: 'gullybid:auction-3d-camera' }));
    expect(hook.result.current.cameraMode).toBe('stage');
  });
});

describe('WebGL 2 capability probe', () => {
  it('requires WebGL 2 and explicitly releases its temporary context', () => {
    const loseContext = vi.fn(); const getExtension = vi.fn(() => ({ loseContext }));
    const probe = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension } as any);
    expect(supportsWebGL()).toBe(true); expect(probe).toHaveBeenCalledExactlyOnceWith('webgl2', { failIfMajorPerformanceCaveat: true });
    expect(loseContext).toHaveBeenCalledTimes(1);
  });
  it('gracefully falls back on missing WebGL 2, a blocked context, or a release error', () => {
    const probe = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    expect(supportsWebGL()).toBe(false);
    probe.mockImplementation(() => { throw new Error('GPU blocked'); }); expect(supportsWebGL()).toBe(false);
    probe.mockReturnValue({ getExtension: () => { throw new Error('Context already gone'); } } as any);
    expect(supportsWebGL()).toBe(true);
  });
});
