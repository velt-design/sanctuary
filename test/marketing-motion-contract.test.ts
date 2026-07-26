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
const readStyle = (file: string) => readFileSync(path.join(repoRoot, file), 'utf8');
const fullGovernedFiles = [
  'apps/marketing/components/marketing-foundation/foundation.module.css',
  'apps/marketing/components/marketing-foundation/Interactions.module.css',
  'apps/marketing/app/projects/ProjectGallery.module.css',
  'apps/marketing/app/projects/projects.css',
  'apps/marketing/app/projects/projectCollection.css',
  'apps/marketing/components/products/product-pages.module.css',
  'apps/marketing/app/_home/homepage.module.css',
  'apps/marketing/app/pergolas-auckland/pergolas-auckland.css',
  'apps/marketing/components/seo-landing/seo-landing.css',
  'apps/marketing/app/contact/contact.css',
  'apps/marketing/components/SiteFooter.module.css',
];
const governedSources = fullGovernedFiles.map((file) => ({
  file,
  source: readStyle(file),
}));
const headerSource = readStyle('apps/marketing/styles/header.css');
const headerTactileSource = headerSource.slice(
  headerSource.indexOf('.nav-cta{'),
  headerSource.indexOf('/* Keep the compact menu and trigger on the same editorial surface. */'),
);
const routeProgressSource = globalsSource.slice(
  globalsSource.indexOf('.route-progress{'),
  globalsSource.indexOf('body.portal-mode .route-progress{'),
);
const scopedGovernedSources = [
  {
    file: 'apps/marketing/styles/header.css (TM-02 tactile owners)',
    source: headerTactileSource,
  },
  {
    file: 'apps/marketing/app/globals.css (route progress)',
    source: routeProgressSource,
  },
];

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

  it('keeps governed Foundation and TM-02 route owners on tokens unless a literal has an inline exemption reason', () => {
    const violations: string[] = [];

    for (const { file, source } of [...governedSources, ...scopedGovernedSources]) {
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
    expect(governedSources[1].source).toContain('.galleryButton:not(:disabled):active');
  });

  it('governs the TM-02 active-state, panel, hover-capability and state-precedence contract', () => {
    const ownerContracts = [
      {
        file: 'apps/marketing/styles/header.css',
        required: [
          '.mobile-toggle:active',
          '.mobile-menu__link:active',
          '.mobile-menu__link[aria-current="page"]:active',
          'var(--motion-duration-panel-exit)',
          'var(--motion-duration-panel-enter)',
          '@media (hover:hover) and (pointer:fine)',
        ],
      },
      {
        file: 'apps/marketing/app/globals.css',
        required: [
          'transform var(--motion-duration-panel-enter) var(--motion-ease-standard)',
          'opacity var(--motion-duration-short) var(--motion-ease-standard)',
          'transition-duration:var(--motion-duration-short), var(--motion-duration-instant)',
        ],
      },
      {
        file: 'apps/marketing/app/projects/ProjectGallery.module.css',
        required: [
          ".control:not([aria-disabled='true']):active",
          ".control[aria-disabled='true']:active",
          '(hover: hover) and (pointer: fine)',
        ],
      },
      {
        file: 'apps/marketing/app/projects/projects.css',
        required: [
          '.project-navigator__trigger:active',
          '.project-navigator__close:active',
          '.project-navigator__list a.is-active:active',
          '.project-action--primary:active',
          '.project-case-study__related-list > a:active',
          '.project-case-study__pagination > a:active',
          'var(--motion-duration-panel-exit)',
          'var(--motion-duration-panel-enter)',
          '@media (hover: hover) and (pointer: fine)',
        ],
      },
      {
        file: 'apps/marketing/app/projects/projectCollection.css',
        required: [
          '.project-navigator__filter-summary:active',
          '.project-navigator__filter-reset:active',
        ],
      },
      {
        file: 'apps/marketing/components/products/product-pages.module.css',
        required: [
          '.productCardLink:active',
          '.mobileDisclosureSummary:active',
          '@media (hover: hover) and (pointer: fine)',
        ],
      },
      {
        file: 'apps/marketing/app/_home/homepage.module.css',
        required: [
          '.intentOption[data-selected="true"]:active',
          '.projectCard:has(a:active)',
          '.audienceGrid article:has(a:active)',
          '.selectedSummary button:active',
        ],
      },
      {
        file: 'apps/marketing/app/pergolas-auckland/pergolas-auckland.css',
        required: ['.pergolas-auckland__mobile-disclosure-summary:active'],
      },
      {
        file: 'apps/marketing/components/seo-landing/seo-landing.css',
        required: ['.seo-landing__mobile-disclosure-summary:active'],
      },
      {
        file: 'apps/marketing/app/contact/contact.css',
        required: [
          '.contact-action:not(:disabled):active',
          '.contact-action--primary:disabled',
          '.contact-form__type-options > label:has(input:checked):active',
          '.contact-form__checks label:has(input:checked)',
          '.contact-form input[type="file"]::file-selector-button:active',
          '.contact-form__files button:active',
          '@media (hover: hover) and (pointer: fine)',
        ],
      },
      {
        file: 'apps/marketing/components/SiteFooter.module.css',
        required: [
          '.primaryAction:active',
          '.navigationLink:active',
          '.reviewAction:active',
          '@media (hover: hover) and (pointer: fine)',
        ],
      },
    ];

    for (const { file, required } of ownerContracts) {
      const source = readStyle(file);
      for (const contract of required) {
        expect(source, `${file} should include ${contract}`).toContain(contract);
      }
    }
  });

  it('removes only the persistent page-layer hint and retains the short-lived progress hint', () => {
    const pageLayerRule = globalsSource.match(/\.page-layer\s*\{([^}]*)\}/)?.[1] ?? '';
    const routeProgressRule = globalsSource.match(/\.route-progress\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(pageLayerRule).not.toContain('will-change');
    expect(routeProgressRule).toContain('will-change:transform, opacity');
  });
});
