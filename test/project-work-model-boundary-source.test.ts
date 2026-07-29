// @vitest-environment node

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const consumers = [
  'apps/portal/lib/projects/getProjectPageSnapshot.ts',
  'apps/portal/lib/projects/commandCentre/getProjectCommandCentre.ts',
  'apps/portal/lib/projects/commandCentre/getProjectCommandExceptions.ts',
  'apps/portal/lib/scheduling/scheduleV2Server.ts',
  'apps/portal/lib/runningJobs/server.ts',
];

describe('Project Work V2 model boundary', () => {
  it.each(consumers)('%s reads model state without embedded PostgREST relationships', (file) => {
    const source = readFileSync(path.join(process.cwd(), file), 'utf8');

    expect(source).not.toContain('workModel:project_work_model_versions');
    expect(source).not.toContain('operationalState:project_operational_states');
    expect(source).toMatch(/isProjectWorkModelV2|getProjectWorkModelV2Ids/);
  });
});
