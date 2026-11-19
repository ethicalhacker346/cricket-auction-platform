import { describe, expect, it, vi } from 'vitest';
import { arenaColor } from './arenaColor';

describe('consistent DOM / Three.js team colors', () => {
  it('correctly parses modern space-separated and legacy comma-separated HSL', () => {
    expect(arenaColor('hsl(240 100% 50%)').getHexString()).toBe('0000ff');
    expect(arenaColor('hsl(120, 100%, 50%)').getHexString()).toBe('00ff00');
    expect(arenaColor('hsl(480 100% 50%)').getHexString()).toBe('00ff00');
  });
  it('handles hex, named colors and both RGB forms in the sRGB color space', () => {
    expect(arenaColor('#abc').getHexString()).toBe('aabbcc');
    expect(arenaColor('rebeccapurple').getHexString()).toBe('663399');
    expect(arenaColor('rgb(255 0 0)').getHexString()).toBe('ff0000');
    expect(arenaColor('rgb(0%,100%,0%)').getHexString()).toBe('00ff00');
  });
  it('falls back without Three.js warnings or accidental white for unsupported/malformed colors', () => {
    const warning = vi.spyOn(console, 'warn');
    for (const value of ['var(--team)', 'hsl(no color)', 'not-a-color', undefined, '#badbadbad', 'rgb(1 2)']) {
      expect(arenaColor(value, '#22d3ee').getHexString()).toBe('22d3ee');
    }
    expect(warning).not.toHaveBeenCalled();
  });
});
