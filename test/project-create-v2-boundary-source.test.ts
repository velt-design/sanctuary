// @vitest-environment node

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function listRuntimeSources(directory: string): string[] {
  const absoluteDirectory = path.join(repoRoot, directory);
  return readdirSync(absoluteDirectory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listRuntimeSources(relativePath);
    if (!/\.(?:ts|tsx)$/.test(entry.name) || /\.test\.(?:ts|tsx)$/.test(entry.name)) return [];
    return [relativePath];
  });
}

describe('Project creation V2 source boundary', () => {
  it('keeps the staff creation path on the authenticated API and project_create_v2 command', () => {
    const createClient = readSource('apps/portal/app/staff/projects/new/ProjectCreateClient.tsx');
    const createRoute = readSource('apps/portal/app/api/staff/v1/projects/route.ts');
    const createCommand = readSource('apps/portal/lib/projects/createProjectCommand.ts');
    const projectsRepo = readSource('apps/portal/lib/repo/projectsRepo.ts');

    expect(createClient).toContain("apiJson<ProjectCreateResponse>('/api/staff/v1/projects'");
    expect(createRoute).toContain('createProjectCommand(auth.supabase, parsed.value)');
    expect(createCommand).toContain("client.rpc('project_create_v2'");
    expect(projectsRepo).not.toMatch(/export\s+async\s+function\s+createProject\s*\(/);
  });

  it('has no runtime consumer of the retired browser-direct createProject export', () => {
    const imports = listRuntimeSources('apps/portal')
      .filter((file) => file !== 'apps/portal/lib/repo/projectsRepo.ts')
      .filter((file) => {
        const source = readSource(file);
        return Array.from(source.matchAll(/import\s+([\s\S]*?)\s+from\s+['"][^'"]*projectsRepo['"]/g))
          .some((match) => /\bcreateProject\b/.test(match[1] ?? ''));
      });

    expect(imports).toEqual([]);
  });
});
