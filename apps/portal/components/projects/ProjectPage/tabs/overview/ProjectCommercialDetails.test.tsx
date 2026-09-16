import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import { commandCentreFixtures } from '@/app/qa/project-command-centre-fixture/fixtures';
import ProjectCommercialDetails from './ProjectCommercialDetails';
import ProjectCurrentDesignCommercialCard from './ProjectCurrentDesignCommercialCard';

afterEach(() => { document.body.innerHTML = ''; });
describe('compact commercial position', () => {
  it('keeps conflicting accepted quotes visible instead of hiding them behind a confident total', () => {
    const data = { ...commandCentreFixtures['accepted-newer-estimate'], warnings: ['multiple_accepted_quotes'] as const };
    const value = { ...data, warnings: [...data.warnings] };
    const view = renderIntoDocument(<ProjectCommercialDetails data={value}><ProjectCurrentDesignCommercialCard data={value} /></ProjectCommercialDetails>);
    expect(view.container.querySelector('details')).toBeNull();
    expect(view.container.textContent).toContain('Multiple accepted versions in one quote family');
    view.unmount();
  });
  it.each([
    ['sent-revision', 'Proposed price: $1,750.00'],
    ['accepted-newer-estimate', 'Agreed price: $1,750.00'],
    ['no-current-design', 'No price prepared yet'],
  ] as const)('keeps %s distinct without showing secondary detail by default', (scenario, expected) => {
    const view = renderIntoDocument(<ProjectCommercialDetails data={commandCentreFixtures[scenario]}><p>Payment evidence</p></ProjectCommercialDetails>);
    expect(view.container.querySelector('summary')?.textContent).toContain(expected);
    expect(view.container.querySelector('details')?.open).toBe(false);
    expect(view.container.textContent).toContain('Payment evidence');
    view.unmount();
  });
});
