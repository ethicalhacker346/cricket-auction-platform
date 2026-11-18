import { useSyncExternalStore } from "react";

export const AUCTION_AUDIO_MUTE_KEY = "auction_audio_muted";
const CHANGE_EVENT = "auction:audio-mute-changed";
let volatilePreference: boolean | null = null;

export function getAuctionAudioMuted(): boolean {
  if (volatilePreference !== null) return volatilePreference;
  try {
    return window.localStorage.getItem(AUCTION_AUDIO_MUTE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setAuctionAudioMuted(muted: boolean) {
  try {
    window.localStorage.setItem(AUCTION_AUDIO_MUTE_KEY, String(muted));
    volatilePreference = null;
  } catch {
    // Private mode / blocked storage must not disable an in-session mute.
    volatilePreference = muted;
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeAuctionAudioMuted(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== AUCTION_AUDIO_MUTE_KEY) return;
    volatilePreference = null;
    listener();
  };
  // The storage event only fires in OTHER tabs. A same-document event is
  // needed to keep the reveal button and the mounted audio engine in sync.
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAuctionAudioMuted() {
  return useSyncExternalStore(subscribeAuctionAudioMuted, getAuctionAudioMuted, () => false);
}
