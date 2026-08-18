import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  aiActivityFixtureDetail,
  aiActivityFixtureTasks,
} from '@/app/qa/ai-activity-fixture/fixtures';
import AiActivityView from './AiActivityView';

describe('AiActivityView', () => {
  it('renders safe task, event, and approval evidence without mutation controls', () => {
    const html = renderToStaticMarkup(
      <AiActivityView tasks={aiActivityFixtureTasks} detail={aiActivityFixtureDetail} />,
    );

    expect(html).toContain('AI Activity');
    expect(html).toContain('Synthetic task recorded with no external effect.');
    expect(html).toContain('synthetic · only');
    expect(html).toContain('Payload fingerprint');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('service_role');
    expect(html).not.toContain('private.ai_task_payloads');
  });

  it('renders a non-leaking empty state when no task is visible', () => {
    const html = renderToStaticMarkup(<AiActivityView tasks={[]} detail={null} />);
    expect(html).toContain('No synthetic tasks');
    expect(html).toContain('Select a visible task');
  });
});
