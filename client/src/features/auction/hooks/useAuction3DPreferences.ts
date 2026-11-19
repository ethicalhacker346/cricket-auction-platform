import { useCallback, useEffect, useRef, useState } from 'react';
import { ARENA_QUALITIES, ARENA_QUALITY_CHOICES, ARENA_RENDER_CONFIG, ArenaQualityGovernor, inferArenaQuality, type ArenaQuality, type ArenaQualityPreference } from '../utils/arenaQuality';

export type Auction3DQuality = ArenaQuality;
export type Auction3DQualityPreference = ArenaQualityPreference;
export type Auction3DCameraMode = 'broadcast' | 'stage' | 'top' | 'floor' | 'orbit';
export const ARENA_CAMERAS: Auction3DCameraMode[] = ['broadcast', 'stage', 'top', 'floor', 'orbit'];
const KEYS = {
  quality: 'gullybid:auction-3d-quality', camera: 'gullybid:auction-3d-camera',
  motion: 'gullybid:auction-3d-motion-paused', follow: 'gullybid:auction-3d-follow-bids',
};
function read(key: string) { try { return window.localStorage.getItem(key); } catch { return null; } }
function save(key: string, value: string) { try { window.localStorage.setItem(key, value); } catch { /* In-session controls remain available. */ } }
function qualityPreference(): ArenaQualityPreference {
  const value = read(KEYS.quality) as ArenaQualityPreference;
  return ARENA_QUALITY_CHOICES.includes(value) ? value : 'auto';
}
function cameraPreference(): Auction3DCameraMode {
  const value = read(KEYS.camera) as Auction3DCameraMode;
  return ARENA_CAMERAS.includes(value) ? value : 'broadcast';
}
function deviceQuality(): ArenaQuality {
  if (typeof window === 'undefined') return 'balanced';
  const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  return inferArenaQuality({ cores: device.hardwareConcurrency, memory: device.deviceMemory,
    compact: window.matchMedia('(max-width: 820px)').matches, saveData: device.connection?.saveData });
}

/** Device-aware defaults, measured adaptation, and explicit viewer agency. */
export function useAuction3DPreferences() {
  const [qualityPreferenceValue, setQualityPreference] = useState(qualityPreference);
  const [ceiling, setCeiling] = useState(deviceQuality);
  const [autoQuality, setAutoQuality] = useState(deviceQuality);
  const [cameraMode, setCameraModeState] = useState(cameraPreference);
  const [motionPaused, setMotionPaused] = useState(() => read(KEYS.motion) === 'true');
  const [followBids, setFollowBidsState] = useState(() => read(KEYS.follow) !== 'false');
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [fps, setFps] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [pageVisible, setPageVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const governor = useRef(new ArenaQualityGovernor());
  const quality = recoveryMode ? 'performance' : qualityPreferenceValue === 'auto' ? autoQuality : qualityPreferenceValue;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches); sync();
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 820px)');
    const sync = () => {
      const next = deviceQuality(); setCeiling(next);
      setAutoQuality((current) => ARENA_QUALITIES.indexOf(current) > ARENA_QUALITIES.indexOf(next) ? next : current);
    };
    media.addEventListener?.('change', sync);
    return () => media.removeEventListener?.('change', sync);
  }, []);
  useEffect(() => {
    const sync = () => { setPageVisible(document.visibilityState !== 'hidden'); governor.current.reset(); };
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === null || event.key === KEYS.quality) { setQualityPreference(qualityPreference()); setRecoveryMode(false); governor.current.reset(); }
      if (event.key === null || event.key === KEYS.camera) setCameraModeState(cameraPreference());
      if (event.key === null || event.key === KEYS.motion) setMotionPaused(read(KEYS.motion) === 'true');
      if (event.key === null || event.key === KEYS.follow) setFollowBidsState(read(KEYS.follow) !== 'false');
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  const setQuality = useCallback((next: ArenaQualityPreference) => {
    if (!ARENA_QUALITY_CHOICES.includes(next)) return;
    setQualityPreference(next); setRecoveryMode(false); governor.current.reset();
    save(KEYS.quality, next);
  }, []);
  const setCameraMode = useCallback((next: Auction3DCameraMode) => {
    if (!ARENA_CAMERAS.includes(next)) return;
    setCameraModeState(next); save(KEYS.camera, next);
  }, []);
  const toggleMotion = useCallback(() => {
    setMotionPaused((paused) => { save(KEYS.motion, String(!paused)); return !paused; });
  }, []);
  const setFollowBids = useCallback((enabled: boolean) => { setFollowBidsState(enabled); save(KEYS.follow, String(enabled)); }, []);
  const reportFrameRate = useCallback((value: number) => {
    if (!pageVisible || reducedMotion || motionPaused || !Number.isFinite(value) || value <= 0) return;
    setFps(Math.round(value));
    if (qualityPreferenceValue === 'auto' && !recoveryMode) {
      setAutoQuality(governor.current.sample(value, autoQuality, ceiling, performance.now()));
    }
  }, [pageVisible, reducedMotion, motionPaused, qualityPreferenceValue, recoveryMode, ceiling, autoQuality]);
  const recoverRenderer = useCallback(() => { setRecoveryMode(true); governor.current.reset(); }, []);

  return {
    quality, qualityPreference: qualityPreferenceValue, setQuality, renderConfig: ARENA_RENDER_CONFIG[quality],
    cameraMode, setCameraMode, reducedMotion, motionPaused, toggleMotion,
    followBids, setFollowBids, pageVisible, fps, reportFrameRate, recoveryMode, recoverRenderer,
  };
}

/** Three.js' renderer requires WebGL 2. Release the probe's GPU allocation. */
export function supportsWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  let context: WebGL2RenderingContext | null = null;
  try {
    const canvas = document.createElement('canvas');
    context = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    return Boolean(context);
  } catch { return false; }
  finally { try { context?.getExtension('WEBGL_lose_context')?.loseContext(); } catch { /* Best-effort release must not break the live screen. */ } }
}
