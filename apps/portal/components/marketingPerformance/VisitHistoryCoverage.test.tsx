import { act } from 'react';
import { expect, it, vi } from 'vitest';
import { renderIntoDocument } from '../../../../test/reactHarness';
import { designerFixture } from '@/app/qa/marketing-performance-fixture/designerFixtures';
import { hubFixture } from '@/app/qa/marketing-performance-fixture/hubFixtures';
import { designerPerformance } from '@/lib/marketingPerformance/designer';
import VisitHistoryCoverage from './VisitHistoryCoverage';

vi.mock('@/components/ui/drawer/Drawer', () => ({ Drawer: ({ open, children, title }: any) => open ? <div role="dialog" aria-label={title}>{children}</div> : null }));
const report = designerFixture();
const props = { report, performance: designerPerformance(report), projectIds: null, hub: hubFixture, allDates: false, selectionKey: 'period-one', selectedPerson: true, pending: false, synthetic: true };
it.each([['original quote date','quote'],['acceptance date','visit']])('identifies %s estimates beside exact retained evidence',(basisKind,label)=>{
 const estimated=designerFixture();Object.assign(estimated.visits[0],{origin:'history',at:null,day:'2026-09-07',basis:`Approximate visit date: 2026-09-07 (${basisKind}; owner-approved).`});
 const view=renderIntoDocument(<VisitHistoryCoverage {...props} report={estimated} performance={designerPerformance(estimated)}/>);
 act(()=>[...view.container.querySelectorAll('button')].find(button=>button.textContent==='Inspect all 2 net accepted jobs')!.click());
 expect(view.container.querySelector('[role=dialog]')!.textContent).toContain(`2026-09-07 (approx. ${label} date)`);view.unmount();
});

it('keeps incomplete-history qualification visible and exposes exact team job and visit evidence', () => {
  const view = renderIntoDocument(<VisitHistoryCoverage {...props} />);
  expect(view.container.querySelector('details')?.open).toBe(false);
  expect(view.container.querySelector('details')?.previousElementSibling?.textContent).toContain('not each person’s full-period performance');
  expect(view.container.textContent).toContain('including visits that never became jobs');
  expect(view.container.textContent).toContain('Team: 2 net accepted jobs');
  expect(view.container.textContent).toContain('even while one person is selected above');
  act(() => [...view.container.querySelectorAll('button')].find(button => button.textContent === 'Inspect all 2 net accepted jobs')!.click());
  const dialog = view.container.querySelector('[role=dialog]')!;
  expect(dialog.querySelectorAll('ol > li')).toHaveLength(2);
  expect(dialog.textContent).toContain('Original visitor: Jordan, JP');
  expect(dialog.textContent).toContain('DEMO-SCOPE-1'); expect(dialog.textContent).toContain('DEMO-SCOPE-9');
  expect(dialog.textContent).toContain('Accepted 11/09/2026');
  expect([...dialog.querySelectorAll('a')].every(link => link.target === '_blank')).toBe(true);
  view.unmount();
});

it('clears inspected evidence on pending refresh, new snapshot, filters and source failure', () => {
  const view = renderIntoDocument(<VisitHistoryCoverage {...props} />);
  const open = () => act(() => [...view.container.querySelectorAll('button')].find(button => button.textContent?.startsWith('Inspect all'))!.click());
  open(); expect(view.container.querySelector('[role=dialog]')).not.toBeNull();
  view.rerender(<VisitHistoryCoverage {...props} pending />); expect(view.container.querySelector('[role=dialog]')).toBeNull();
  view.rerender(<VisitHistoryCoverage {...props} selectionKey="other-period" />); expect(view.container.querySelector('[role=dialog]')).toBeNull();
  const fresh = structuredClone(report); view.rerender(<VisitHistoryCoverage {...props} report={fresh} performance={designerPerformance(fresh)} />); expect(view.container.querySelector('[role=dialog]')).toBeNull();
  const failed = { ...fresh, source: { ...fresh.source, failed: true } };
  view.rerender(<VisitHistoryCoverage {...props} report={failed} performance={designerPerformance(failed)} />);
  expect(view.container.textContent).toContain('No missing-record counts are shown'); expect(view.container.querySelector('[aria-label^="Team coverage:"]')).toBeNull();
  view.unmount();
});

it('does not show absence counts or fabricated zeros while reads are unavailable', () => {
  const view = renderIntoDocument(<VisitHistoryCoverage {...props} report={null} performance={null} pending />);
  expect(view.container.textContent).toContain('Reading the complete sales and visit evidence');
  expect(view.container.textContent).not.toContain('0 net accepted');
  view.rerender(<VisitHistoryCoverage {...props} report={null} performance={null} pending={false} />);
  expect(view.container.textContent).toContain('Coverage evidence unavailable'); expect(view.container.querySelector('[aria-label^="Team coverage:"]')).toBeNull(); view.unmount();
});

it('pages large evidence sets without losing or repeating jobs', () => {
  const many = structuredClone(report);
  many.visits = []; many.assignments = []; many.salesOutcomes = [];
  many.salesProjects = Array.from({ length: 16 }, (_, n) => ({ projectId: `99999999-9999-4999-8999-${String(n).padStart(12, '0')}`, state: 'ACTIVE', closedOutcome: null }));
  many.scopes = many.salesProjects.map((project, n) => ({ ...report.scopes[0], projectId: project.projectId, id: `88888888-8888-4888-8888-${String(n).padStart(12, '0')}`, reference: `PAGE-SCOPE-${n}` }));
  const view = renderIntoDocument(<VisitHistoryCoverage {...props} report={many} performance={designerPerformance(many)} />);
  const click = (text: string) => act(() => [...view.container.querySelectorAll('button')].find(button => button.textContent === text)!.click());
  click('Inspect all 16 net accepted jobs');
  expect(view.container.querySelectorAll('[role=dialog] ol > li')).toHaveLength(15);
  expect(view.container.querySelector('[role=dialog]')?.textContent).not.toContain('PAGE-SCOPE-15');
  click('Next'); expect(view.container.querySelectorAll('[role=dialog] ol > li')).toHaveLength(1);
  expect(view.container.querySelector('[role=dialog]')?.textContent).toContain('PAGE-SCOPE-15');
  expect(view.container.querySelector('[role=dialog]')?.textContent).toContain('Page 2 of 2');
  click('Previous'); expect(view.container.querySelectorAll('[role=dialog] ol > li')).toHaveLength(15);
  view.unmount();
});
