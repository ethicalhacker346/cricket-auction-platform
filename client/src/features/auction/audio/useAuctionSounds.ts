import { useCallback, useEffect, useRef } from "react";
import { AuctionAudioManager } from "./AuctionAudioManager";
import { useLiveAuctionStore } from "../store/index.store";

/**
 * Mount once near the auction UI root (via <AuctionSoundEngine />).
 *
 * Owns a single AuctionAudioManager: a fully-synthesized WebAudio engine —
 * no audio-file assets, sample-accurate scheduling, a mastered signal chain
 * (compressor + generated-impulse reverb), and user-gesture unlock. Feeds
 * it timer updates from the live store so urgency ticks stay aligned with
 * the authoritative server clock.
 */
export function useAuctionSounds() {
  const managerRef = useRef<AuctionAudioManager | null>(null);

  if (!managerRef.current && typeof window !== "undefined") {
    managerRef.current = new AuctionAudioManager();
  }

  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;
    const unsub = useLiveAuctionStore.subscribe(
      (s) => manager.onTimerUpdate(s.timer.remaining),
    );
    return () => {
      unsub();
      manager.destroy();
      managerRef.current = null;
    };
  }, []);

  const toggleMute = useCallback(() => {
    const manager = managerRef.current;
    if (!manager) return;
    manager.setMuted(!manager.muted);
  }, []);

  return {
    toggleMute,
    get muted() {
      return managerRef.current?.muted ?? false;
    },
  };
}
