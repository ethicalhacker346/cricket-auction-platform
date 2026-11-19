import { Color, MathUtils, SRGBColorSpace } from 'three';

function parse(value: string | undefined): Color | null {
  const input = value?.trim().toLowerCase();
  if (!input || input.length > 80) return null;
  if (/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(input)) return new Color(input);
  if (Object.prototype.hasOwnProperty.call(Color.NAMES, input)) return new Color(Color.NAMES[input as keyof typeof Color.NAMES]);
  const match = /^(hsl|rgb)\(([^)]+)\)$/.exec(input);
  if (!match) return null;
  // DOM team colors use CSS Color 4's space-separated hsl(). Three.js still
  // expects commas and otherwise silently leaves the color WHITE. Parse both
  // forms ourselves, explicitly converting sRGB into the renderer's space.
  const values = match[2].split(/[\s,]+/).filter(Boolean);
  if (values.length !== 3) return null;
  const unit = /^-?\d+(?:\.\d+)?$/;
  const percent = /^-?\d+(?:\.\d+)?%$/;
  if (match[1] === 'hsl' && unit.test(values[0]) && percent.test(values[1]) && percent.test(values[2])) {
    return new Color().setHSL(Number(values[0]) / 360,
      MathUtils.clamp(parseFloat(values[1]) / 100, 0, 1), MathUtils.clamp(parseFloat(values[2]) / 100, 0, 1), SRGBColorSpace);
  }
  if (match[1] === 'rgb' && values.every((value) => unit.test(value) || percent.test(value))) {
    const channels = values.map((value) => MathUtils.clamp(parseFloat(value) / (value.endsWith('%') ? 100 : 255), 0, 1));
    return new Color().setRGB(channels[0], channels[1], channels[2], SRGBColorSpace);
  }
  return null;
}

export function arenaColor(value: string | undefined, fallback = '#22d3ee'): Color {
  return parse(value) ?? parse(fallback) ?? new Color('#22d3ee');
}
