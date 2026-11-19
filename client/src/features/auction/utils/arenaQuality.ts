export type ArenaQuality = 'performance' | 'balanced' | 'cinematic';
export type ArenaQualityPreference = 'auto' | ArenaQuality;
export const ARENA_QUALITIES: ArenaQuality[] = ['performance', 'balanced', 'cinematic'];
export const ARENA_QUALITY_CHOICES: ArenaQualityPreference[] = ['auto', ...ARENA_QUALITIES];

export interface ArenaRenderConfig {
  maxDpr: number; antialias: boolean; shadows: boolean; sparkles: number; contactShadowResolution: number;
}
export const ARENA_RENDER_CONFIG: Record<ArenaQuality, ArenaRenderConfig> = {
  performance: { maxDpr: 1, antialias: false, shadows: false, sparkles: 24, contactShadowResolution: 256 },
  balanced: { maxDpr: 1.5, antialias: true, shadows: true, sparkles: 72, contactShadowResolution: 512 },
  cinematic: { maxDpr: 2, antialias: true, shadows: true, sparkles: 140, contactShadowResolution: 1024 },
};

export function inferArenaQuality({ cores = 4, memory = 4, compact = false, saveData = false } = {}): ArenaQuality {
  if (compact || saveData || cores <= 4 || memory <= 4) return 'performance';
  return cores >= 8 && memory >= 8 ? 'cinematic' : 'balanced';
}

/** Sustained samples + hysteresis, not a quality flip for one long GC frame. */
export class ArenaQualityGovernor {
  private low = 0;
  private high = 0;
  private changedAt = -Infinity;
  sample(fps: number, current: ArenaQuality, ceiling: ArenaQuality, now: number): ArenaQuality {
    if (!Number.isFinite(fps) || fps <= 0) return current;
    this.low = fps < 28 ? this.low + 1 : 0;
    this.high = fps >= 55 ? this.high + 1 : 0;
    const tier = ARENA_QUALITIES.indexOf(current);
    if (this.low >= 2 && tier > 0 && now - this.changedAt >= 5000) {
      this.low = 0; this.high = 0; this.changedAt = now;
      return ARENA_QUALITIES[tier - 1];
    }
    if (this.high >= 10 && tier < ARENA_QUALITIES.indexOf(ceiling) && now - this.changedAt >= 30_000) {
      this.low = 0; this.high = 0; this.changedAt = now;
      return ARENA_QUALITIES[tier + 1];
    }
    return current;
  }
  reset() { this.low = 0; this.high = 0; }
}

/** Stable capacity, but a leader beyond the first page must never disappear. */
export function stageTeams<T extends { id: string }>(teams: T[], leaderId: string | null, capacity = 12): T[] {
  if (capacity <= 0) return [];
  const unique = [...new Map(teams.map((team) => [team.id, team])).values()];
  const visible = unique.slice(0, capacity);
  const leader = unique.find((team) => team.id === leaderId);
  if (leader && !visible.some((team) => team.id === leaderId)) visible[visible.length - 1] = leader;
  return visible;
}
