import { act, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderIntoDocument } from '../../../../../test/reactHarness';
import type { CalculatorIssue } from './calculatorIssueNavigation';
import { useCalculatorIssueNavigation } from './useCalculatorIssueNavigation';

type IssueNavigation = ReturnType<typeof useCalculatorIssueNavigation>;

let latest: IssueNavigation | null = null;

function navigation(): IssueNavigation {
  if (!latest) throw new Error('Issue navigation probe has not rendered.');
  return latest;
}

function Probe() {
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  latest = useCalculatorIssueNavigation({ activeModuleIndex, setActiveModuleIndex });
  return <div data-active-module={activeModuleIndex} />;
}

afterEach(() => {
  latest = null;
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('useCalculatorIssueNavigation', () => {
  it('owns issue dialog visibility', () => {
    const rendered = renderIntoDocument(<Probe />);

    act(() => navigation().openIssues());
    expect(navigation().issuesOpen).toBe(true);
    act(() => navigation().closeIssues());
    expect(navigation().issuesOpen).toBe(false);

    rendered.unmount();
  });

  it('changes module, closes the dialog, then scrolls and focuses the issue field', () => {
    const rendered = renderIntoDocument(<Probe />);
    const input = document.createElement('input');
    input.id = 'projectionM';
    input.scrollIntoView = vi.fn();
    const focus = vi.spyOn(input, 'focus');
    document.body.appendChild(input);
    const issue: CalculatorIssue = {
      moduleIndex: 1,
      moduleLabel: 'Module 2',
      fieldId: input.id,
      sectionId: 'structure',
      label: 'Roof Span (m)',
      message: 'Required',
    };

    act(() => navigation().openIssues());
    act(() => navigation().selectIssue(issue));

    expect(rendered.container.querySelector('[data-active-module]')?.getAttribute('data-active-module')).toBe('1');
    expect(navigation().issuesOpen).toBe(false);
    expect(input.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });

    rendered.unmount();
  });
});
