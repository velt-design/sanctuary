import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import CalculatorCommandBar from './CalculatorCommandBar';

function renderBar(overrides: Partial<Parameters<typeof CalculatorCommandBar>[0]> = {}) {
  return renderToStaticMarkup(
    <CalculatorCommandBar
      projectLabel="Agent Project"
      isEditingDesign
      activeModuleLabel="Pergola 1 · Module 1"
      uiMode="basic"
      onUiModeChange={vi.fn()}
      resultFreshness="current"
      localDraftStatus={{ kind: 'saved' }}
      blockerCount={0}
      onSelectProject={vi.fn()}
      saveLabel="Save"
      saveDisabled={false}
      onSave={vi.fn()}
      {...overrides}
    />,
  );
}

describe('CalculatorCommandBar', () => {
  it('renders the persistent workflow context and accessible mode state', () => {
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
    expect(markup.indexOf('data-calculator-command-actions')).toBeLessThan(markup.indexOf('>Save</button>'));
  });

  it('renders blocker count, freshness context, error, and a disabled save', () => {
    const markup = renderBar({
      resultFreshness: 'invalid',
      blockerCount: 3,
      saveDisabled: true,
      saveError: 'Fix inputs.',
    });
    expect(markup).toContain('3 blockers');
    expect(markup).toContain('Last valid result — fix inputs. 3 blockers');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('Fix inputs.');
  });

  it('renders fixed project identity without a picker in embedded mode', () => {
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
