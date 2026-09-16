import { describe, expect, it } from 'vitest';
import { DEFAULT_PREVIEW_DRAFT } from '../../components/configurator-prototype/previewDraft';
import { buildContactDesignBrief } from './contactDesignBrief';
import { buildContactDesignSubmission } from './contactDesignSubmission';
import { getContactEnquiryAudience } from './contactJourney';

describe('configured enquiry submission', () => {
  it('carries the full configured reference without submitting a browser price or mislabelling it as Simple', () => {
    const brief = buildContactDesignBrief({ ...DEFAULT_PREVIEW_DRAFT, roof: { family: 'gable', orientation: 'parallel', infills: false }, result: null,
      configuratorPrice: { status: 'priced', amountIncGst: 24000, currency: 'NZD', includesGst: true, versionNumber: 12,
        calculationRef: 'cf1.signed-reference', breakdown: [{ label: 'Pergola, roof & ceiling', amountIncGst: 24000 }] } });
    const submission = buildContactDesignSubmission(brief);
    expect(submission.calculationRef).toBe('cf1.signed-reference');
    expect(submission.simpleCoverStatus).toBeNull();
    expect(brief.estimate).toBeNull();
    expect(submission.style).toBe('gable');
    expect(JSON.stringify(submission)).not.toContain('24000');
  });
  it.each(['gable', 'box'] as const)('retains an unpriced %s combination design without classifying it as bespoke', family => {
    const brief = buildContactDesignBrief({
      input: DEFAULT_PREVIEW_DRAFT.input,
      roof: { family, orientation: 'parallel', infills: false, finish: {
        material: 'combination', profile: 'corrugated', layout: 'central', acrylicBays: 2, trayWidth: 400,
      } }, result: null,
    });
    const submission = buildContactDesignSubmission(brief);
    expect(getContactEnquiryAudience('configured', null)).toBe('residential');
    expect(submission.style).toBe(family === 'box' ? 'perimeter' : 'gable');
    expect(submission.roofMaterials).toEqual(['acrylic', 'timber']);
    expect(submission.dimensions).toEqual(brief.dimensions);
    expect(submission.calculationRef).toBeNull();
    expect(submission.simpleCoverStatus).toBeNull();
  });

  it('retains a signed simple estimate reference while keeping design dimensions', () => {
    const brief = buildContactDesignBrief({ ...DEFAULT_PREVIEW_DRAFT, result: null });
    brief.estimate = {
      schemaVersion: 'simple-cover-handoff.v1', input: brief.snapshot.input,
      status: 'priced', calculationRef: 'signed-reference', displayedPriceIncGst: 15000, configurationVersion: 1,
    };
    const submission = buildContactDesignSubmission(brief);
    expect(submission.calculationRef).toBe('signed-reference');
    expect(submission.simpleCoverStatus).toBe('priced');
    expect(submission.dimensions.widthM).toBe(brief.snapshot.input.widthMm / 1000);
    expect(submission).not.toHaveProperty('displayedPriceIncGst');
  });
});
