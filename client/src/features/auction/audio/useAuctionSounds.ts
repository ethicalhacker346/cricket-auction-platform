import { useEffect, useRef } from 'react';
import { useLiveAuctionStore } from '@/features/auction/store/index.store';
import { AuctionAudioManager } from './AuctionAudioManager';

let globalManager: AuctionAudioManager | null = null;

export function useAuctionSounds() {
  const remaining = useLiveAuctionStore((s) => s.timer.remaining);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    if (!globalManager) {
      globalManager = new AuctionAudioManager({
        sounds: {
          hammer:       { src: '/sounds/hammer.mp3', volume: 0.8 },
          bell:         { src: '/sounds/bell.mp3', volume: 0.7 },
          gavel:        { src: '/sounds/gavel.mp3', volume: 1.0 },
          applause:     { src: '/sounds/applause.mp3', volume: 0.5 },
          lowTone:      { src: '/sounds/low-tone.mp3', volume: 0.8 },
          openingTheme: { src: '/sounds/opening.mp3', volume: 0.6 },
          softBell:     { src: '/sounds/soft-bell.mp3', volume: 0.5 },
          resumeBell:   { src: '/sounds/resume-bell.mp3', volume: 0.6 },
          success:      { src: '/sounds/success.mp3', volume: 0.7 },
          tick:         { src: '/sounds/tick.mp3', volume: 0.4 },
          tickFast:     { src: '/sounds/tick-fast.mp3', volume: 0.5 },
          tickFinal:    { src: '/sounds/tick-final.mp3', volume: 0.8 },
          crowd:        { src: '/sounds/crowd.mp3', volume: 0.3 },
        },
        masterVolume: 0.85,
        muted: JSON.parse(localStorage.getItem('auction_audio_muted') ?? 'false'),
      });
    }

    // We intentionally do NOT destroy on unmount.
    // The manager is global per auction session.
  }, []);

  useEffect(() => {
    globalManager?.onTimerUpdate(remaining);
  }, [remaining]);

  return {
    setMuted: (v: boolean) => globalManager?.setMuted(v),
    setVolume: (v: number) => globalManager?.setMaster(v),
    get muted() { return globalManager?.muted ?? false; },
  };
}