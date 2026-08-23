import { useCallback, useEffect, useMemo, useState } from "react";

export type Auction3DQuality = "performance" | "balanced" | "cinematic";
export type Auction3DCameraMode = "broadcast" | "stage" | "top" | "floor" | "orbit";

const QUALITY_KEY = "gullybid:auction-3d-quality";
const CAMERA_KEY = "gullybid:auction-3d-camera";

const isQuality = (value: string | null): value is Auction3DQuality =>
  value === "performance" || value === "balanced" || value === "cinematic";

const isCameraMode = (value: string | null): value is Auction3DCameraMode =>
  value === "broadcast" ||
  value === "stage" ||
  value === "top" ||
  value === "floor" ||
  value === "orbit";

function inferQuality(): Auction3DQuality {
  if (typeof window === "undefined") return "balanced";

  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  const compactViewport = window.matchMedia("(max-width: 820px)").matches;

  if (compactViewport || cores <= 4 || memory <= 4) return "performance";
  if (cores >= 8 && memory >= 8) return "cinematic";
  return "balanced";
}

function readQuality(): Auction3DQuality {
  if (typeof window === "undefined") return "balanced";
  try {
    const saved = window.localStorage.getItem(QUALITY_KEY);
    return isQuality(saved) ? saved : inferQuality();
  } catch {
    return inferQuality();
  }
}

function readCameraMode(): Auction3DCameraMode {
  if (typeof window === "undefined") return "broadcast";
  try {
    const saved = window.localStorage.getItem(CAMERA_KEY);
    return isCameraMode(saved) ? saved : "broadcast";
  } catch {
    return "broadcast";
  }
}

/**
 * Centralizes the expensive-rendering decisions for the immersive room.
 * The initial tier is inferred from memory/CPU/viewport and every explicit
 * choice is persisted. Reduced-motion always wins over decorative motion.
 */
export function useAuction3DPreferences() {
  const [quality, setQualityState] = useState<Auction3DQuality>(readQuality);
  const [cameraMode, setCameraModeState] = useState<Auction3DCameraMode>(readCameraMode);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden",
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  const setQuality = useCallback((next: Auction3DQuality) => {
    setQualityState(next);
    try {
      window.localStorage.setItem(QUALITY_KEY, next);
    } catch {
      // Storage can be blocked in private/webview contexts; rendering still works.
    }
  }, []);

  const setCameraMode = useCallback((next: Auction3DCameraMode) => {
    setCameraModeState(next);
    try {
      window.localStorage.setItem(CAMERA_KEY, next);
    } catch {
      // Non-critical preference.
    }
  }, []);

  const renderConfig = useMemo(() => {
    switch (quality) {
      case "performance":
        return {
          maxDpr: 1,
          antialias: false,
          shadows: false,
          sparkles: 42,
          contactShadowResolution: 256,
        };
      case "cinematic":
        return {
          maxDpr: 2,
          antialias: true,
          shadows: true,
          sparkles: 150,
          contactShadowResolution: 1024,
        };
      default:
        return {
          maxDpr: 1.5,
          antialias: true,
          shadows: true,
          sparkles: 88,
          contactShadowResolution: 512,
        };
    }
  }, [quality]);

  return {
    quality,
    setQuality,
    cameraMode,
    setCameraMode,
    reducedMotion,
    pageVisible,
    renderConfig,
  };
}

export function supportsWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGL2RenderingContext && canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: true }),
    ) || Boolean(canvas.getContext("webgl", { failIfMajorPerformanceCaveat: true }));
  } catch {
    return false;
  }
}
