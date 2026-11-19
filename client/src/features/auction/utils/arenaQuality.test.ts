import { describe, expect, it } from 'vitest';
import { ARENA_RENDER_CONFIG, ArenaQualityGovernor, inferArenaQuality, stageTeams } from './arenaQuality';
import { watchWebGLContext } from './rendererHealth';

describe('adaptive arena budgets', () => {
  it('starts conservatively on mobile, low-memory, low-core and data-saving devices', () => {
    expect(inferArenaQuality()).toBe('performance');
    expect(inferArenaQuality({ cores: 8, memory: 8 })).toBe('cinematic');
    expect(inferArenaQuality({ cores: 6, memory: 6 })).toBe('balanced');
    for (const hints of [{ compact: true }, { saveData: true }, { cores: 2 }, { memory: 2 }]) {
      expect(inferArenaQuality({ cores: 8, memory: 8, ...hints })).toBe('performance');
    }
    expect(ARENA_RENDER_CONFIG.performance.shadows).toBe(false);
    expect(ARENA_RENDER_CONFIG.performance.maxDpr).toBeLessThan(ARENA_RENDER_CONFIG.cinematic.maxDpr);
  });
  it('ignores isolated slow frames and downgrades only after sustained samples', () => {
    const governor = new ArenaQualityGovernor();
    expect(governor.sample(20, 'cinematic', 'cinematic', 0)).toBe('cinematic');
    expect(governor.sample(45, 'cinematic', 'cinematic', 3000)).toBe('cinematic');
    expect(governor.sample(20, 'cinematic', 'cinematic', 6000)).toBe('cinematic');
    expect(governor.sample(20, 'cinematic', 'cinematic', 9000)).toBe('balanced');
    expect(governor.sample(20, 'balanced', 'cinematic', 10_000)).toBe('balanced');
    expect(governor.sample(20, 'balanced', 'cinematic', 11_000)).toBe('balanced');
    expect(governor.sample(20, 'balanced', 'cinematic', 15_000)).toBe('performance');
    expect(governor.sample(1, 'performance', 'cinematic', 18_000)).toBe('performance');
  });
  it('recovers slowly, respects the device ceiling and safely ignores invalid samples', () => {
    const governor = new ArenaQualityGovernor();
    for (let i = 0; i < 9; i++) expect(governor.sample(60, 'performance', 'balanced', i * 3000)).toBe('performance');
    expect(governor.sample(60, 'performance', 'balanced', 27_000)).toBe('balanced');
    for (let i = 0; i < 12; i++) expect(governor.sample(60, 'balanced', 'balanced', 30_000 + i * 3000)).toBe('balanced');
    for (const fps of [NaN, Infinity, 0, -1]) expect(governor.sample(fps, 'balanced', 'cinematic', 80_000)).toBe('balanced');
    governor.reset();
    expect(governor.sample(20, 'balanced', 'balanced', 90_000)).toBe('balanced');
  });
  it('keeps GPU team capacity bounded but always includes the actual leader', () => {
    const teams = Array.from({ length: 1000 }, (_, index) => ({ id: `team-${index}` }));
    const visible = stageTeams(teams, 'team-999');
    expect(visible).toHaveLength(12);
    expect(visible.slice(0, 11)).toEqual(teams.slice(0, 11));
    expect(visible[11].id).toBe('team-999');
    expect(stageTeams([...teams, teams[0]], 'team-0')).toHaveLength(12);
    expect(stageTeams([], null)).toEqual([]);
    expect(stageTeams(teams, 'team-999', 0)).toEqual([]);
    expect(teams).toHaveLength(1000);
  });
});

describe('native graphics recovery lifecycle', () => {
  it('allows restoration, deduplicates context notifications and detaches all handlers', () => {
    const canvas = document.createElement('canvas');
    let losses = 0; let restores = 0;
    const detach = watchWebGLContext(canvas, () => { losses++; }, () => { restores++; });
    canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(restores).toBe(0);
    const lost = new Event('webglcontextlost', { cancelable: true });
    canvas.dispatchEvent(lost); canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
    expect(lost.defaultPrevented).toBe(true); expect(losses).toBe(1);
    canvas.dispatchEvent(new Event('webglcontextrestored')); canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(restores).toBe(1);
    detach(); canvas.dispatchEvent(new Event('webglcontextlost')); canvas.dispatchEvent(new Event('webglcontextrestored'));
    expect(losses).toBe(1); expect(restores).toBe(1);
  });
});
