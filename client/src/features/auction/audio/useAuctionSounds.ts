import { useCallback, useEffect } from "react";
import { AuctionAudioManager } from "./AuctionAudioManager";
import { useLiveAuctionStore } from "../store/index.store";
import { getAuctionAudioMuted, setAuctionAudioMuted, useAuctionAudioMuted } from "./audioPreference";

/**
 * Mount once near the auction UI root (via <AuctionSoundEngine />).
 * Owns one live manager/subscription, created ONLY in an effect. React
 * StrictMode replays setup → cleanup → setup; render-time construction
 * leaked a manager and left the committed tree with a destroyed one.
 */
export function useAuctionSounds() {
  const muted = useAuctionAudioMuted();

  useEffect(() => {
    const manager = new AuctionAudioManager();
    const unsubscribe = useLiveAuctionStore.subscribe(
      (state) => manager.onTimerUpdate(state.timer.remaining),
    );
    return () => {
      unsubscribe();
      manager.destroy();
    };
  }, []);

  const toggleMute = useCallback(() => {
    setAuctionAudioMuted(!getAuctionAudioMuted());
  }, []);

  return { toggleMute, muted };
}
