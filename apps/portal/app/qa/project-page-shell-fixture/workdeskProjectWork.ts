import { projectStory } from '../project-command-centre-fixture/projectStories';
import { projectId } from './commercialClarityData';

/** The snapshot and delayed command read describe the same synthetic work. */
export function workdeskProjectWork() {
  const work = structuredClone(projectStory('installation').work.projectWork);
  work.projectId = projectId;
  work.openItems = work.openItems.map(item => ({
    ...item, projectId, dueAt: '2026-10-29T00:00:00.000Z', title: item.title.replaceAll('Aroha', 'the customer'),
  }));
  if (work.primaryAction.kind === 'workItem') work.primaryAction = {
    ...work.primaryAction, item: work.openItems[0], reason: work.primaryAction.reason.replaceAll('Aroha', 'The customer'),
  };
  return work;
}
