import { afterEach, describe, expect, it } from 'vitest';
import { renderIntoDocument } from '../../../../../../../test/reactHarness';
import { correspondenceFixture } from '@/app/qa/project-command-centre-fixture/correspondenceFixture';
import ProjectCorrespondenceCard from './ProjectCorrespondenceCard';
import { correspondenceSourceHref } from './projectCorrespondencePresentation';

afterEach(() => { document.body.innerHTML = ''; });
describe('ProjectCorrespondenceCard', () => {
  it('shows each email excerpt without opening AI analysis and makes samples explicit', () => {
    const view = renderIntoDocument(<ProjectCorrespondenceCard context={correspondenceFixture} state="ready" sample />);
    const messages = view.container.querySelectorAll('article blockquote');
    expect(messages).toHaveLength(1);
    expect(messages[0].closest('details')).toBeNull();
    expect(view.container.textContent).toContain('Your real Outlook emails are not connected');
    expect(view.container.querySelector('a')).toBeNull();
    view.unmount();
  });
  it('keeps suggestions distinct from confirmed project work and reveals cited evidence', () => {
    const view = renderIntoDocument(<ProjectCorrespondenceCard context={correspondenceFixture} state="ready" />);
    expect(view.container.textContent).toContain('AI interpretation');
    expect(view.container.textContent).toContain('Suggestion');
    expect(view.container.textContent).toContain('project not confirmed');
    expect(view.container.textContent).toContain('Project Work controls above');
    expect(view.container.querySelector('blockquote')?.textContent).toContain('Please confirm the expected installation week');
    expect(view.container.querySelectorAll('button')).toHaveLength(0);
    view.unmount();
  });

  it('does not display an unsupported claim or an unsafe source link', () => {
    const context = { ...correspondenceFixture, sources: [{ ...correspondenceFixture.sources[0], url: 'javascript:alert(1)' }] };
    const view = renderIntoDocument(<ProjectCorrespondenceCard context={context} state="ready" />);
    expect(view.container.textContent).not.toContain('The customer is asking');
    expect(view.container.textContent).toContain('supporting source is unavailable');
    expect(view.container.querySelector('a')).toBeNull();
    view.unmount();
  });

  it('hides an old summary when the read is unavailable', () => {
    const view = renderIntoDocument(<ProjectCorrespondenceCard context={correspondenceFixture} state="error" />);
    expect(view.container.textContent).toContain('Conversations unavailable');
    expect(view.container.textContent).not.toContain('The customer is asking');
    view.unmount();
  });

  it.each(['https://outlook.office.com.evil.test/mail', 'https://user:secret@outlook.office.com/mail', 'http://outlook.office.com/mail', 'https://portal.sanctuarypergolas.co.nz/api/admin/reset'])('rejects an unsafe source %s', (url) => {
    expect(correspondenceSourceHref(url)).toBeNull();
  });
});
