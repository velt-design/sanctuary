type RGB = readonly [number, number, number];
const rgb = (hex: string): RGB => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)) as unknown as RGB;
const mix = (a: RGB, b: RGB, amount: number): RGB => a.map((v, i) => v + (b[i] - v) * amount) as unknown as RGB;
const css = (color: RGB) => `rgb(${color.map(Math.round).join(', ')})`;
const luminance = (color: RGB) => color.reduce((sum, channel, i) => {
  const value = channel / 255;
  return sum + (value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][i];
}, 0);
const contrast = (a: RGB, b: RGB) => {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
};

// A straight dark-to-light text blend disappears against the middle of a
// light-to-dark surface blend. Keep the desired colour where readable, otherwise
// move it towards the higher-contrast pole. This is a function of scene progress,
// not a second animation or delayed theme switch. Each surface has its own text.
function readable(desired: RGB, background: RGB): RGB {
  if (contrast(desired, background) >= 4.6) return desired;
  const pole: RGB = luminance(background) > .179 ? [0, 0, 0] : [255, 255, 255];
  let lo = 0, hi = 1;
  for (let i = 0; i < 12; i++) {
    const t = (lo + hi) / 2;
    if (contrast(mix(desired, pole, t), background) >= 4.6) hi = t; else lo = t;
  }
  return mix(desired, pole, hi);
}

// Existing marketing day colours and the configurator's original night palette.
const surfaces = {
  warm: [rgb('#f1f0eb'), rgb('#202523')],
  elevated: [rgb('#f8f8f5'), rgb('#282d2b')],
  selected: [rgb('#edf0e8'), rgb('#444e43')],
  accent: [rgb('#4f5748'), rgb('#a8b6a1')],
} as const;
const foregrounds = {
  primary: [rgb('#111210'), rgb('#f3eee4')],
  secondary: [rgb('#555852'), rgb('#d3d6cf')],
  subtle: [rgb('#5f635c'), rgb('#aeb6ad')],
} as const;

export function dayNightTheme(amount: number): Record<string, string> {
  const surface = Object.fromEntries(Object.entries(surfaces).map(([name, [day, night]]) => [name, mix(day, night, amount)])) as Record<keyof typeof surfaces, RGB>;
  const result: Record<string, string> = {
    '--night-amount': String(amount),
    '--color-surface-warm': css(surface.warm),
    '--color-surface-elevated': css(surface.elevated),
    '--control-selected': css(surface.selected),
    '--color-accent-olive': css(surface.accent),
    '--color-on-accent': css(readable(mix(surfaces.warm[0], surfaces.warm[1], amount), surface.accent)),
    '--color-rule': css(mix(rgb('#c7cac3'), rgb('#515b54'), amount)),
    '--color-rule-strong': css(mix(rgb('#aeb2aa'), rgb('#697469'), amount)),
  };
  for (const name of ['warm', 'elevated', 'selected'] as const) {
    for (const [role, [day, night]] of Object.entries(foregrounds)) {
      result[`--theme-${name}-${role}`] = css(readable(mix(day, night, amount), surface[name]));
      if (name === 'warm') result[`--color-text-${role}`] = result[`--theme-${name}-${role}`];
    }
  }
  return result;
}
