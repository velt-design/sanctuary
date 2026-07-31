import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PORTAL_ROOT = path.join(process.cwd(), 'apps/portal');

function productionSources(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const absolute = path.join(directory, name);
    if (statSync(absolute).isDirectory()) {
      if (name === '.next') return [];
      return productionSources(absolute);
    }
    if (
      !/\.(?:ts|tsx)$/.test(name)
      || /\.test\.(?:ts|tsx)$/.test(name)
    ) {
      return [];
    }
    return [absolute];
  });
}

describe('legacy project task retirement contract', () => {
  it('has no application readers or writers for retired task/action stores', () => {
    const source = productionSources(PORTAL_ROOT)
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    for (const retiredStore of [
      'project_task_checks',
      'followup_plans',
      'followup_tasks',
      'project_manual_actions',
      'project_action_controls',
      'project_primary_action_selections',
      'project_action_versions',
      'project_command_action',
      'project_command_sync_design_task',
    ]) {
      expect(source).not.toContain(retiredStore);
    }
    expect(source).not.toMatch(/\.from\((['"])tasks\1\)/);
  });

  it('does not expose retired task or legacy-review routes', () => {
    for (const retiredRoute of [
      'app/api/projects/[projectId]/tasks/route.ts',
      'app/api/staff/v1/projects/[projectId]/command-centre/primary-action/commands/route.ts',
      'app/api/admin/project-work/legacy-contacted/route.ts',
      'app/staff/projects/work-queue/legacy-review/page.tsx',
    ]) {
      expect(existsSync(path.join(PORTAL_ROOT, retiredRoute))).toBe(false);
    }
  });
});
