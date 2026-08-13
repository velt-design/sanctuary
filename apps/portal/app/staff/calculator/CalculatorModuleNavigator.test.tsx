import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../../test/reactHarness';
import CalculatorModuleNavigator from './CalculatorModuleNavigator';
import type { CalculatorModuleNavigatorModel } from './calculatorModuleNavigation';

const model: CalculatorModuleNavigatorModel = {
  groups: [
    {
      pergolaId: 'pergola-1',
      label: 'Pergola 1',
      items: [
        {
          key: 'pergola-1:0',
          moduleIndex: 0,
          pergolaId: 'pergola-1',
          pergolaLabel: 'Pergola 1',
          localModuleIndex: 0,
          label: 'Pergola 1 · Module 1',
          styleLabel: 'Pitched',
          dimensionsLabel: '6m × 3m',
          issueCount: 0,
          isActive: true,
        },
      ],
    },
    {
      pergolaId: 'pergola-2',
      label: 'Pergola 2',
      items: [
        {
          key: 'pergola-2:1',
          moduleIndex: 1,
          pergolaId: 'pergola-2',
          pergolaLabel: 'Pergola 2',
          localModuleIndex: 0,
          label: 'Pergola 2 · Module 1',
          styleLabel: 'Gable',
          dimensionsLabel: '4.8m × 3.2m',
          issueCount: 2,
          isActive: false,
        },
      ],
    },
  ],
  items: [],
  activeModuleLabel: 'Pergola 1 · Module 1',
  totalIssueCount: 2,
};
model.items = model.groups.flatMap((group) => group.items);

function findButton(root: ParentNode, label: string): HTMLButtonElement {
  const button = Array.from(root.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function renderNavigator(overrides: Partial<Parameters<typeof CalculatorModuleNavigator>[0]> = {}) {
  const props = {
    model,
    pergolas: [
      { id: 'pergola-1', label: 'Pergola 1' },
      { id: 'pergola-2', label: 'Pergola 2' },
    ],
    moduleCount: 2,
    onSelectModule: vi.fn(),
    onAddModule: vi.fn(),
    onAddPergola: vi.fn(),
    onRenamePergola: vi.fn(),
    onDuplicateModule: vi.fn(),
    onMoveModule: vi.fn(),
    onRemoveModule: vi.fn(),
    ...overrides,
  };
  const rendered = renderIntoDocument(<CalculatorModuleNavigator {...props} />);
  return { ...rendered, props };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CalculatorModuleNavigator', () => {
  it('renders grouped canonical module summaries, active state, and issue counts', () => {
    renderNavigator();
    const rail = document.querySelector('aside[aria-label="Module navigator"]') as HTMLElement;
    expect(rail.textContent).toContain('2 modules across 2 pergolas');
    expect(rail.textContent).toContain('Pergola 1 · Module 1');
    expect(rail.textContent).toContain('Pitched · 6m × 3m');
    expect(rail.textContent).toContain('Pergola 2 · Module 1');
    expect(rail.textContent).toContain('2 issues');
    expect(rail.querySelector('button[aria-current="true"]')?.textContent).toContain('Pergola 1 · Module 1');
    const actions = rail.querySelector('[data-module-actions="compact"]');
    expect(actions?.textContent).toContain('Duplicate');
    expect(actions?.textContent).toContain('Move');
    expect(actions?.textContent).toContain('Remove');
  });

  it('uses singular issue grammar in the rail and mobile launcher', () => {
    const singularModel: CalculatorModuleNavigatorModel = {
      ...model,
      groups: model.groups.map((group) => ({
        ...group,
        items: group.items.map((item, index) => ({
          ...item,
          issueCount: index === 0 && group.pergolaId === 'pergola-2' ? 1 : 0,
        })),
      })),
      items: [],
      totalIssueCount: 1,
    };
    singularModel.items = singularModel.groups.flatMap((group) => group.items);

    renderNavigator({ model: singularModel });

    expect(document.body.textContent).toContain('1 issue');
    expect(document.body.textContent).not.toContain('1 issues');
  });

  it('uses singular module grammar in the mobile launcher', () => {
    const singleModuleModel: CalculatorModuleNavigatorModel = {
      ...model,
      groups: [model.groups[0]],
      items: model.groups[0].items,
      totalIssueCount: 0,
    };
    renderNavigator({
      model: singleModuleModel,
      moduleCount: 1,
      pergolas: [{ id: 'pergola-1', label: 'Pergola 1' }],
    });

    const launcher = document.querySelector('[data-calculator-module-launcher]');
    expect(launcher?.textContent).toContain('1 module');
    expect(launcher?.textContent).not.toContain('1 modules');
  });

  it('keeps an empty pergola visible with its add-module action', () => {
    const emptyPergolaModel: CalculatorModuleNavigatorModel = {
      ...model,
      groups: [model.groups[0], { ...model.groups[1], items: [] }],
      items: model.groups[0].items,
      totalIssueCount: 0,
    };
    renderNavigator({ model: emptyPergolaModel });
    const rail = document.querySelector('aside[aria-label="Module navigator"]') as HTMLElement;
    expect(rail.textContent).toContain('No modules in this pergola.');
    expect(rail.querySelector('button[aria-label="Add module to Pergola 2"]')).not.toBeNull();
  });

  it('shows the optional-pergola empty state for an estimate', () => {
    const emptyModel: CalculatorModuleNavigatorModel = {
      groups: [],
      items: [],
      activeModuleLabel: 'No module selected',
      totalIssueCount: 0,
    };
    const { props } = renderNavigator({
      model: emptyModel,
      pergolas: [],
      moduleCount: 0,
      allowEmptyModules: true,
    });
    const rail = document.querySelector('aside[aria-label="Module navigator"]') as HTMLElement;

    expect(rail.textContent).toContain('0 modules across 0 pergolas');
    expect(rail.textContent).toContain('No pergolas in this estimate');
    act(() => findButton(rail, 'Add pergola').click());
    expect(props.onAddPergola).toHaveBeenCalledTimes(1);
  });

  it('commits a pergola name when the editable heading loses focus', () => {
    const { props } = renderNavigator();
    const input = document.querySelector('aside[aria-label="Module navigator"] input[aria-label="Name for Pergola 1"]') as HTMLInputElement;
    act(() => {
      input.value = 'Front patio';
      input.dispatchEvent(new Event('focusout', { bubbles: true }));
    });
    expect(props.onRenamePergola).toHaveBeenCalledWith('pergola-1', 'Front patio');
  });

  it('selects modules and exposes fresh add and duplicate actions', () => {
    const { props } = renderNavigator();
    const rail = document.querySelector('aside[aria-label="Module navigator"]') as HTMLElement;
    const secondModule = Array.from(rail.querySelectorAll('button')).find((button) => button.textContent?.includes('Pergola 2 · Module 1')) as HTMLButtonElement;
    act(() => secondModule.click());
    act(() => (rail.querySelector('button[aria-label="Add module to Pergola 2"]') as HTMLButtonElement).click());
    act(() => findButton(rail, 'Duplicate').click());
    act(() => findButton(rail, 'Add pergola').click());

    expect(props.onSelectModule).toHaveBeenCalledWith(1);
    expect(props.onAddModule).toHaveBeenCalledWith('pergola-2');
    expect(props.onDuplicateModule).toHaveBeenCalledWith(0);
    expect(props.onAddPergola).toHaveBeenCalledTimes(1);
  });

  it('moves the active module through the explicit destination panel', () => {
    const { props } = renderNavigator();
    const rail = document.querySelector('aside[aria-label="Module navigator"]') as HTMLElement;
    act(() => findButton(rail, 'Move').click());
    const select = rail.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('pergola-2');
    act(() => findButton(rail, 'Move module').click());
    expect(props.onMoveModule).toHaveBeenCalledWith(0, 'pergola-2');
  });

  it('removes the active module immediately without opening a confirmation dialog', () => {
    const { props } = renderNavigator();
    const rail = document.querySelector('aside[aria-label="Module navigator"]') as HTMLElement;
    act(() => findButton(rail, 'Remove').click());
    expect(props.onRemoveModule).toHaveBeenCalledWith(0);
    expect(document.querySelector('[role="dialog"][aria-label="Remove module?"]')).toBeNull();
  });

  it('opens the narrow navigator dialog, selects a module, and returns focus to the launcher', async () => {
    const { props } = renderNavigator();
    const launcher = document.querySelector('button[aria-haspopup="dialog"]') as HTMLButtonElement;
    await act(async () => {
      launcher.focus();
      launcher.click();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });
    const dialog = document.querySelector('[role="dialog"][aria-label="Module navigator"]') as HTMLElement;
    expect(dialog).not.toBeNull();
    const secondModule = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent?.includes('Pergola 2 · Module 1')) as HTMLButtonElement;
    await act(async () => {
      secondModule.click();
    });
    expect(props.onSelectModule).toHaveBeenCalledWith(1);
    expect(document.querySelector('[role="dialog"][aria-label="Module navigator"]')).toBeNull();
    expect(document.activeElement).toBe(launcher);
  });

  it('disables removal when only one module remains', () => {
    renderNavigator({ moduleCount: 1 });
    const rail = document.querySelector('aside[aria-label="Module navigator"]') as HTMLElement;
    expect(findButton(rail, 'Remove').disabled).toBe(true);
  });

  it('allows removal of the final module for an add-on', () => {
    renderNavigator({ moduleCount: 1, allowEmptyModules: true });
    const rail = document.querySelector('aside[aria-label="Module navigator"]') as HTMLElement;
    expect(findButton(rail, 'Remove').disabled).toBe(false);
  });
});
