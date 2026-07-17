// src/hooks/usePlayerDraft.ts
import { useEffect, useCallback } from "react";
import type { PlayerFormValues } from "@/lib/validators/playerSchema";

const STORAGE_KEY = "gullybid:player-draft";

export function usePlayerDraft() {
  const save = useCallback((values: Partial<PlayerFormValues>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  }, []);

  const load = useCallback((): Partial<PlayerFormValues> | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { save, load, clear };
}