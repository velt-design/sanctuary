import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import { commandCentreFixtures } from '@/app/qa/project-command-centre-fixture/fixtures';
import ProjectCommercialDetails from './ProjectCommercialDetails';
import ProjectCurrentDesignCommercialCard from './ProjectCurrentDesignCommercialCard';

afterEach(() => { document.body.innerHTML = ''; });
describe('compact commercial position', () => {
  it('explains retained accepted history without inventing a warning or correction task', () => {
    const data = { ...commandCentreFixtures['accepted-newer-estimate'], warnings: ['multiple_accepted_quotes'] as const };
    const value = { ...data, warnings: [...data.warnings] };
    const view = renderIntoDocument(<ProjectCommercialDetails data={value}><ProjectCurrentDesignCommercialCard data={value} /></ProjectCommercialDetails>);
    const history = view.container.querySelector('details')!;
    expect(history.open).toBe(false);
    expect(history.querySelector('summary')?.textContent).toBe('Quote history');
    const metrics = view.container.querySelector('[aria-label="Current design and commercial metrics"]')!;
    expect(metrics.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(view.container.textContent).toContain('Current agreement:');
    expect(view.container.textContent).toContain('Earlier accepted versions are retained');
    expect(view.container.querySelector('[data-tone="warning"]')).toBeNull();
    expect(view.container.textContent).toContain('the newest accepted version');
    expect(view.container.querySelector('a')?.getAttribute('href')).toBe(value.links.quotes);
    view.unmount();
  });
  it.each([
    ['sent-revision', 'Proposed price$1,750.00'],
    ['accepted-newer-estimate', 'Agreed price$1,750.00'],
    ['no-current-design', 'Current estimateNot prepared'],
  ] as const)('keeps %s distinct without showing secondary detail by default', (scenario, expected) => {
    const view = renderIntoDocument(<ProjectCommercialDetails data={commandCentreFixtures[scenario]}><p>Payment evidence</p></ProjectCommercialDetails>);
    expect(view.container.querySelector('summary')?.textContent).toContain(expected);
    expect(view.container.querySelector('details')?.open).toBe(false);
    expect(view.container.textContent).toContain('Payment evidence');
    view.unmount();
  });
});
