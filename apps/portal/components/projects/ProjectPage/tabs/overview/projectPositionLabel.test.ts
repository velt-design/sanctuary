import { describe, expect, it } from 'vitest';
import { commandCentreFixtures } from '@/app/qa/project-command-centre-fixture/fixtures';
import { projectPositionLabel } from './projectPositionLabel';

describe('saved project position', () => {
  it('does not infer payment or scheduling from an accepted quote', () => {
    expect(projectPositionLabel('sent', 'ACTIVE', commandCentreFixtures['accepted-newer-estimate'])).toBe('Quote accepted');
  });
  it('puts deliberate waiting and closure before commercial progress', () => {
    expect(projectPositionLabel('deposit', 'WAITING', commandCentreFixtures['accepted-newer-estimate'])).toBe('Project on hold');
    expect(projectPositionLabel('deposit', 'CLOSED', commandCentreFixtures['accepted-newer-estimate'])).toBe('Closed project');
  });
  it('does not present a sent proposal as an accepted agreement', () => {
    expect(projectPositionLabel('sent', 'ACTIVE', commandCentreFixtures['sent-revision'])).toBe('Quote sent · decision outstanding');
  });
});
