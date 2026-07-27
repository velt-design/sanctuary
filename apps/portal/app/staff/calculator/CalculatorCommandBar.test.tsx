import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import CalculatorCommandBar from './CalculatorCommandBar';
import type { CalculatorReadinessSummary } from './calculatorReadinessSummary';

const readySummary: CalculatorReadinessSummary = {
  tone: 'ready',
  label: 'Ready to save',
  accessibleLabel: 'Ready to save',
  rootCauseCount: 0,
  blockedCheckCount: 0,
  reviewCount: 0,
};

function renderBar(overrides: Partial<Parameters<typeof CalculatorCommandBar>[0]> = {}) {
  return renderToStaticMarkup(
    <CalculatorCommandBar
      projectLabel="Agent Project"
      isEditingDesign
      activeModuleLabel="Pergola 1 · Module 1"
      uiMode="basic"
      onUiModeChange={vi.fn()}
      readinessSummary={readySummary}
      localDraftStatus={{ kind: 'saved' }}
      onSelectProject={vi.fn()}
      saveLabel="Save"
      saveDisabled={false}
      onSave={vi.fn()}
      {...overrides}
    />,
  );
}

describe('CalculatorCommandBar', () => {
  it('renders identity, readiness, Basic/Advanced, and one Save in source order', () => {
    const markup = renderBar();

    expect(markup).toContain('<h1');
    expect(markup).toContain('Calculator');
    expect(markup).toContain('Agent Project');
    expect(markup).toContain('Editing draft');
    expect(markup).toContain('Pergola 1 · Module 1');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('Ready to save');
    expect(markup).toContain('Saved locally');
    expect(markup).toContain('Browser draft only — use Save to update the estimate.');
    expect(markup).toContain('data-calculator-command-actions="true"');
    expect(markup.indexOf('data-calculator-command-identity')).toBeLessThan(
      markup.indexOf('data-calculator-command-readiness'),
    );
    expect(markup.indexOf('data-calculator-command-readiness')).toBeLessThan(
      markup.indexOf('>Basic</button>'),
    );
    expect(markup.indexOf('>Basic</button>')).toBeLessThan(
      markup.indexOf('>Advanced</button>'),
    );
    expect(markup.indexOf('>Advanced</button>')).toBeLessThan(
      markup.indexOf('data-calculator-command-save'),
    );
    expect(markup.match(/data-calculator-command-save/g)).toHaveLength(1);
  });

  it.each([
    ['1 input issue blocks Save', '1 input issue blocks Save. 2 readiness checks blocked.', 1],
    ['3 input issues block Save', '3 input issues block Save. 2 readiness checks blocked.', 3],
  ] as const)('renders causal grammar for %s', (label, accessibleLabel, rootCauseCount) => {
    const markup = renderBar({
      readinessSummary: {
        tone: 'blocked',
        label,
        accessibleLabel,
        rootCauseCount,
        blockedCheckCount: 2,
        reviewCount: 0,
      },
      saveDisabled: true,
    });

    expect(markup).toContain(label);
    expect(markup).toContain(accessibleLabel);
    expect(markup).toContain('disabled=""');
  });

  it.each([
    ['current', readySummary],
    [
      'Updating',
      {
        ...readySummary,
        tone: 'waiting' as const,
        label: 'Updating - Save waits for a current result',
        accessibleLabel: 'Updating - Save waits for a current result. 1 readiness check blocked.',
        blockedCheckCount: 1,
      },
    ],
    [
      'retained',
      {
        ...readySummary,
        tone: 'waiting' as const,
        label: 'Recalculation pending - Save waits for a current result',
        accessibleLabel:
          'Recalculation pending - Save waits for a current result. 1 readiness check blocked.',
        blockedCheckCount: 1,
      },
    ],
    [
      'error',
      {
        ...readySummary,
        tone: 'blocked' as const,
        label: 'Engine error blocks Save',
        accessibleLabel: 'Engine error blocks Save. 1 readiness check blocked.',
        rootCauseCount: 1,
        blockedCheckCount: 1,
      },
    ],
  ] as const)(
    'renders the %s readiness state without changing Save semantics',
    (_state, readinessSummary) => {
      const markup = renderBar({
        readinessSummary,
        saveDisabled: readinessSummary.tone !== 'ready',
        saveError: readinessSummary.tone === 'blocked' ? 'Fix inputs.' : undefined,
      });

      expect(markup).toContain(readinessSummary.label);
      expect(markup.includes('disabled=""')).toBe(readinessSummary.tone !== 'ready');
      if (readinessSummary.tone === 'blocked') {
        expect(markup).toContain('Fix inputs.');
      }
    },
  );

  it('uses flex/source flow without CSS order or grid placement overrides', () => {
    const css = readFileSync(
      'apps/portal/app/staff/calculator/CalculatorTrustUi.module.css',
      'utf8',
    );

    expect(css).not.toMatch(/^\s*order\s*:/m);
    expect(css).not.toMatch(/^\s*grid-(?:column|row)\s*:/m);
  });

  it('renders fixed project identity without a picker in standalone mode', () => {
    const markup = renderBar({ onSelectProject: undefined });
    expect(markup).toContain('data-calculator-project-picker="fixed"');
    expect(markup).not.toContain('data-calculator-project-picker="enabled"');
  });

  it('uses compact project design navigation without duplicating the Calculator or project heading', () => {
    const markup = renderBar({
      variant: 'embedded',
      onSelectProject: undefined,
      designNavigation: {
        value: 'draft:est_1',
        stateLabel: 'Current draft · V2',
        options: [
          { value: 'draft:est_1', label: 'Current draft · V2' },
          { value: 'new', label: 'Start a blank design' },
        ],
        onChange: vi.fn(),
      },
    });

    expect(markup).toContain('aria-label="Design version"');
    expect(markup).toContain('Current draft · V2');
    expect(markup).toContain('Editing draft');
    expect(markup).toContain('Pergola 1 · Module 1');
    expect(markup).not.toContain('<h1');
    expect(markup).not.toContain('Agent Project');
    expect(markup).toContain('Saved locally');
    expect(markup).toContain('title="Browser draft only — use Save to update the estimate."');
  });
});
