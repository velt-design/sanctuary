import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const tokenSource = readFileSync(
  path.join(repoRoot, 'apps/marketing/styles/tokens.css'),
  'utf8',
);
const globalsSource = readFileSync(
  path.join(repoRoot, 'apps/marketing/app/globals.css'),
  'utf8',
);
const governedSources = [
  'apps/marketing/components/marketing-foundation/foundation.module.css',
  'apps/marketing/components/marketing-foundation/Interactions.module.css',
].map((file) => ({
  file,
  source: readFileSync(path.join(repoRoot, file), 'utf8'),
}));

const allowedLiteralDurations = new Set(['0ms', '.01ms']);
const literalMotionValue = /(?<![\w.-])(?:\d+(?:\.\d+)?|\.\d+)(?:ms|s)\b|cubic-bezier\([^)]*\)/g;
const exemptionWithReason = /\/\*\s*motion-contract-exempt:\s*\S[^*]*\*\//;

describe('marketing motion contract', () => {
  it('defines the canonical motion and pressed-state tokens with reduced-motion overrides', () => {
    for (const [token, value] of Object.entries({
      '--motion-duration-instant': '80ms',
      '--motion-duration-short': '160ms',
      '--motion-duration-panel-enter': '220ms',
      '--motion-duration-panel-exit': '150ms',
      '--motion-ease-standard': 'cubic-bezier(.2, 0, 0, 1)',
      '--motion-ease-enter': 'cubic-bezier(.16, 1, .3, 1)',
      '--motion-ease-exit': 'cubic-bezier(.4, 0, .7, .2)',
      '--motion-press-scale': '.992',
      '--motion-press-opacity': '.82',
    })) {
      expect(tokenSource.match(new RegExp(`${token}:\\s*${value.replace(/[().]/g, '\\$&')};`, 'g')))
        .toHaveLength(1);
    }

    const reducedMotionSource = tokenSource.slice(
      tokenSource.indexOf('@media (prefers-reduced-motion: reduce)'),
    );
    expect(reducedMotionSource).toContain('--motion-duration-instant: 0ms;');
    expect(reducedMotionSource).toContain('--motion-duration-short: 0ms;');
    expect(reducedMotionSource).toContain('--motion-duration-panel-enter: 0ms;');
    expect(reducedMotionSource).toContain('--motion-duration-panel-exit: 0ms;');
    expect(reducedMotionSource).toContain('--motion-press-scale: 1;');
    expect(reducedMotionSource).toContain('--motion-press-opacity: .86;');
  });

  it('keeps governed Foundation styles on tokens unless a literal has an inline exemption reason', () => {
    const violations: string[] = [];

    for (const { file, source } of governedSources) {
      source.split('\n').forEach((line, index) => {
        const literals = line.match(literalMotionValue) ?? [];
        const unapproved = literals.filter((literal) => !allowedLiteralDurations.has(literal));
        if (unapproved.length > 0 && !exemptionWithReason.test(line)) {
          violations.push(`${file}:${index + 1} (${unapproved.join(', ')})`);
        }
      });
    }

    expect(violations).toEqual([]);
    expect(governedSources[0].source).toContain('var(--motion-press-scale)');
    expect(governedSources[0].source).toContain('var(--motion-press-opacity)');
    expect(governedSources[1].source).toContain('var(--motion-duration-instant)');
    expect(governedSources[1].source).toContain('var(--motion-duration-short)');
  });

  it('removes only the persistent page-layer hint and retains the short-lived progress hint', () => {
    const pageLayerRule = globalsSource.match(/\.page-layer\s*\{([^}]*)\}/)?.[1] ?? '';
    const routeProgressRule = globalsSource.match(/\.route-progress\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(pageLayerRule).not.toContain('will-change');
    expect(routeProgressRule).toContain('will-change:transform, opacity');
  });
});
