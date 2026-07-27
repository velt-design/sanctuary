import type { Locator } from '@playwright/test';

type ContrastForegroundProperty = 'color' | 'outlineColor' | 'borderTopColor';

export async function computedContrastRatio(
  locator: Locator,
  {
    foregroundProperty = 'color',
    backgroundOrigin = 'self',
  }: {
    foregroundProperty?: ContrastForegroundProperty;
    backgroundOrigin?: 'self' | 'parent';
  } = {},
): Promise<number> {
  return locator.evaluate((element, options) => {
    type Colour = { red: number; green: number; blue: number; alpha: number };

    const parseColour = (value: string): Colour => {
      if (value === 'transparent') return { red: 0, green: 0, blue: 0, alpha: 0 };

      const rgbMatch = value.match(/^rgba?\((.+)\)$/i);
      if (rgbMatch) {
        const channels = rgbMatch[1]!.split(/[\s,/]+/).filter(Boolean);
        const channel = (index: number) => {
          const part = channels[index] ?? '0';
          return part.endsWith('%') ? Number.parseFloat(part) * 2.55 : Number.parseFloat(part);
        };
        return {
          red: channel(0),
          green: channel(1),
          blue: channel(2),
          alpha: channels[3] === undefined ? 1 : Number.parseFloat(channels[3]!),
        };
      }

      const srgbMatch = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/i);
      if (srgbMatch) {
        return {
          red: Number.parseFloat(srgbMatch[1]!) * 255,
          green: Number.parseFloat(srgbMatch[2]!) * 255,
          blue: Number.parseFloat(srgbMatch[3]!) * 255,
          alpha: srgbMatch[4] === undefined ? 1 : Number.parseFloat(srgbMatch[4]),
        };
      }

      throw new Error(`Unsupported computed colour: ${value}`);
    };

    const composite = (foreground: Colour, background: Colour): Colour => {
      const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
      if (alpha <= 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
      return {
        red: (foreground.red * foreground.alpha + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
        green: (foreground.green * foreground.alpha + background.green * background.alpha * (1 - foreground.alpha)) / alpha,
        blue: (foreground.blue * foreground.alpha + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
        alpha,
      };
    };

    const backgroundLayers: Colour[] = [];
    let backgroundElement: Element | null =
      options.backgroundOrigin === 'parent' ? element.parentElement : element;
    while (backgroundElement) {
      const layer = parseColour(getComputedStyle(backgroundElement).backgroundColor);
      backgroundLayers.push(layer);
      if (layer.alpha >= 0.999) break;
      backgroundElement = backgroundElement.parentElement;
    }

    let background: Colour = { red: 255, green: 255, blue: 255, alpha: 1 };
    for (const layer of backgroundLayers.reverse()) background = composite(layer, background);

    const style = getComputedStyle(element);
    const foreground = composite(parseColour(style[options.foregroundProperty]), background);
    const luminance = (colour: Colour) =>
      [colour.red, colour.green, colour.blue]
        .map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.03928
            ? normalized / 12.92
            : ((normalized + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!,
          0,
        );
    const foregroundLuminance = luminance(foreground);
    const backgroundLuminance = luminance(background);
    return (
      (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
      (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
    );
  }, { foregroundProperty, backgroundOrigin });
}
