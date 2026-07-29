import { describe, expect, it } from 'vitest';
import { startFlowContent } from './startFlowContent';

describe('start flow copy', () => {
  it('keeps the mobile entry point short and direct', () => {
    expect(startFlowContent.hero).toMatchObject({
      heading: 'Start your pergola brief.',
      subheading: 'Choose your project type, preferred roof and what you know about the site.',
    });

    expect(startFlowContent.branch.options.every((option) => option.description.split(/\s+/).length <= 10)).toBe(
      true
    );
  });

  it('uses one neutral consent statement instead of a threshold verdict', () => {
    expect(startFlowContent.consent.disclaimer).toBe(
      "Consent depends on the final design and property. We'll identify the checks needed for your project."
    );

    expect(JSON.stringify(startFlowContent)).not.toMatch(
      /in 3 minutes|all-season|year-round|built for nz wind|likely exempt|likely required|20m|30m/i
    );
  });

  it('does not repeat a generic delivery timeline before the brief', () => {
    expect('timeline' in startFlowContent.process).toBe(false);
  });
});
