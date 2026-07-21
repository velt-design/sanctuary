import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

describe('foundation style guardrails', () => {
  it('does not hide document overflow to mask layout defects', () => {
    const tokens = read('apps/portal/components/ui/foundation/foundation.tokens.css');
    const catalogue = read('apps/portal/app/staff/ui-foundation/ui-foundation.module.css');
    expect(`${tokens}\n${catalogue}`).not.toMatch(/overflow-x:\s*clip/);
  });

  it('stops indefinite loading motion and pressed transforms for reduced motion', () => {
    const controls = read('apps/portal/components/ui/foundation/FoundationControls.module.css');
    const surfaces = read('apps/portal/components/ui/foundation/FoundationSurfaces.module.css');
    expect(controls).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?\.spinner\s*\{\s*animation:\s*none/);
    expect(controls).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?transform:\s*none/);
    expect(surfaces).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?animation:\s*none/);
  });

  it('uses a dark semantic foreground for action orange', () => {
    const tokens = read('apps/portal/components/ui/foundation/foundation.tokens.css');
    const controls = read('apps/portal/components/ui/foundation/FoundationControls.module.css');
    expect(tokens).toContain('--ui-action-foreground: #11110f');
    expect(controls).toContain('--control-colour: var(--ui-action-foreground)');
  });
});
