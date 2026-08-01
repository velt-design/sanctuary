import { describe, expect, it } from 'vitest';
import {
  answerGuidedQuestion,
  buildGuidedDestinationHref,
  buildGuidedHomeHref,
  buildGuidedReturnHref,
  changeGuidedAnswer,
  getAllGuidedQuestions,
  getGuidedQuestion,
  getGuidedResult,
  getGuidedScreen,
  getGuidedSummaryItems,
  guidedBusinessRoles,
  guidedBusinessSectors,
  guidedCoverFocuses,
  guidedOutdoorUses,
  guidedProfessionalNeeds,
  guidedProfessionalStages,
  guidedSiteConstraints,
  parseGuidedConversationRecord,
  parseGuidedConversationState,
  type GuidedAnswerValue,
  type GuidedConversationState,
  type GuidedResultId,
} from './guidedConversationModel';

type CompletePath = {
  state: GuidedConversationState;
  answers: GuidedAnswerValue[];
  resultId: GuidedResultId;
};

const completePaths: CompletePath[] = [
  ...guidedCoverFocuses.map((focus) => ({
    state: { audience: 'home', goal: 'straightforward-cover', focus } as const,
    answers: ['home', 'straightforward-cover', focus] as GuidedAnswerValue[],
    resultId: 'residential-cover' as const,
  })),
  ...guidedOutdoorUses.map((use) => ({
    state: { audience: 'home', goal: 'outdoor-room', use } as const,
    answers: ['home', 'outdoor-room', use] as GuidedAnswerValue[],
    resultId: 'outdoor-room' as const,
  })),
  ...guidedSiteConstraints.map((constraint) => ({
    state: { audience: 'home', goal: 'difficult-site', constraint } as const,
    answers: ['home', 'difficult-site', constraint] as GuidedAnswerValue[],
    resultId: 'bespoke' as const,
  })),
  ...guidedBusinessSectors.flatMap((sector) => (
    guidedBusinessRoles.map((role) => ({
      state: { audience: 'business', sector, role } as const,
      answers: ['business', sector, role] as GuidedAnswerValue[],
      resultId: 'commercial' as const,
    }))
  )),
  ...guidedProfessionalStages.flatMap((stage) => (
    guidedProfessionalNeeds.map((need) => ({
      state: { audience: 'professional', stage, need } as const,
      answers: ['professional', stage, need] as GuidedAnswerValue[],
      resultId: 'professional' as const,
    }))
  )),
];

function parseHref(href: string) {
  return parseGuidedConversationState(
    new URL(href, 'https://www.sanctuarypergolas.co.nz').searchParams,
  );
}

describe('guided design conversation model', () => {
  it('resolves all 27 valid three-answer branches and all five results', () => {
    expect(completePaths).toHaveLength(27);
    const resultIds = new Set<GuidedResultId>();

    for (const path of completePaths) {
      const screen = getGuidedScreen(path.state);
      expect(screen.kind).toBe('result');
      if (screen.kind !== 'result') continue;
      expect(screen.result.id).toBe(path.resultId);
      expect(screen.result.answerPath).toEqual(path.answers);
      resultIds.add(screen.result.id);
    }

    expect([...resultIds].sort()).toEqual([
      'bespoke',
      'commercial',
      'outdoor-room',
      'professional',
      'residential-cover',
    ]);
  });

  it('round-trips every valid state through closed URL parameters', () => {
    for (const { state } of completePaths) {
      const href = buildGuidedHomeHref(state);
      expect(parseHref(href)).toEqual(state);
      expect(buildGuidedReturnHref(state)).toBe(href);
      expect(href).not.toMatch(/name|email|phone|address|message/i);
    }
  });

  it('removes unknown and incompatible parameters to the nearest valid state', () => {
    expect(parseHref(
      '/home-guided?audience=unknown&goal=outdoor-room&use=poolside',
    )).toEqual({});
    expect(parseHref(
      '/home-guided?audience=home&goal=outdoor-room&focus=shade&use=poolside&role=lead',
    )).toEqual({ audience: 'home', goal: 'outdoor-room', use: 'poolside' });
    expect(parseHref(
      '/home-guided?audience=business&sector=unknown&role=lead',
    )).toEqual({ audience: 'business' });
    expect(parseHref(
      '/home-guided?audience=professional&stage=concept&need=not-known',
    )).toEqual({ audience: 'professional', stage: 'concept' });
    expect(parseGuidedConversationRecord({
      audience: ['home', 'business'],
      goal: 'outdoor-room',
    })).toEqual({});
  });

  it('clears every incompatible downstream answer when an earlier answer changes', () => {
    const completed: GuidedConversationState = {
      audience: 'home',
      goal: 'outdoor-room',
      use: 'entertaining',
    };

    expect(changeGuidedAnswer(completed, 'audience')).toEqual({});
    expect(changeGuidedAnswer(completed, 'home-goal')).toEqual({
      audience: 'home',
    });
    expect(changeGuidedAnswer(completed, 'home-outdoor-use')).toEqual({
      audience: 'home',
      goal: 'outdoor-room',
    });
  });

  it('accepts only an option from the active question', () => {
    const initial: GuidedConversationState = {};
    expect(answerGuidedQuestion(initial, 'home-goal', 'outdoor-room'))
      .toBe(initial);
    expect(answerGuidedQuestion(initial, 'audience', 'poolside'))
      .toBe(initial);
    expect(answerGuidedQuestion(initial, 'audience', 'home')).toEqual({
      audience: 'home',
    });
  });

  it('has no dead ends and never offers more than three options', () => {
    for (const question of getAllGuidedQuestions()) {
      expect(question.options.length).toBeGreaterThan(1);
      expect(question.options.length).toBeLessThanOrEqual(3);
      expect(new Set(question.options.map((option) => option.value)).size)
        .toBe(question.options.length);
    }

    for (const path of completePaths) {
      let state: GuidedConversationState = {};
      for (const answer of path.answers) {
        const screen = getGuidedScreen(state);
        expect(screen.kind).toBe('question');
        if (screen.kind !== 'question') break;
        expect(getGuidedQuestion(screen.id).options).not.toHaveLength(0);
        const next = answerGuidedQuestion(state, screen.id, answer);
        expect(next).not.toBe(state);
        state = next;
      }
      expect(getGuidedResult(state)?.id).toBe(path.resultId);
    }
  });

  it('builds the required destination URL for each pathway', () => {
    expect(buildGuidedDestinationHref({
      audience: 'home',
      goal: 'straightforward-cover',
      focus: 'daylight',
    })).toBe('/pergolas-auckland?focus=daylight');
    expect(buildGuidedDestinationHref({
      audience: 'home',
      goal: 'outdoor-room',
      use: 'entertaining',
    })).toBe('/outdoor-rooms-auckland?use=entertaining');
    expect(buildGuidedDestinationHref({
      audience: 'home',
      goal: 'difficult-site',
      constraint: 'structure',
    })).toBe('/custom-pergolas-auckland?constraint=structure');
    expect(buildGuidedDestinationHref({
      audience: 'business',
      sector: 'hospitality',
      role: 'lead',
    })).toBe('/commercial-pergolas-auckland?sector=hospitality&role=lead');
    expect(buildGuidedDestinationHref({
      audience: 'professional',
      stage: 'concept',
      need: 'design-input',
    })).toBe('/architects-designers-builders?stage=concept&need=design-input');
    expect(buildGuidedDestinationHref({ audience: 'home' })).toBeNull();
  });

  it('selects the conditional result explanation and final evidence label', () => {
    const residential = getGuidedResult({
      audience: 'home',
      goal: 'straightforward-cover',
      focus: 'shade',
    });
    expect(residential?.explanation).toContain('shade and thermal comfort');
    expect(residential?.evidenceLabel).toBe('More shade and thermal comfort');

    const commercial = getGuidedResult({
      audience: 'business',
      sector: 'recreation',
      role: 'feasibility',
    });
    expect(commercial?.explanation).toContain('recreation or specialist setting');
    expect(commercial?.explanation).toContain('scope defined');

    const professional = getGuidedResult({
      audience: 'professional',
      stage: 'developed',
      need: 'scope',
    });
    expect(professional?.explanation).toContain('developed design or tender');
    expect(professional?.explanation).toContain('responsibilities confirmed');
  });

  it('returns concise, editable summaries in conversation order', () => {
    expect(getGuidedSummaryItems({
      audience: 'professional',
      stage: 'delivery',
      need: 'delivery-coordination',
    })).toMatchObject([
      { step: 1, questionId: 'audience', answerLabel: 'A client project' },
      { step: 2, questionId: 'professional-stage', answerLabel: 'Coordination and delivery' },
      { step: 3, questionId: 'professional-need', answerLabel: 'Supply, installation and coordination' },
    ]);
  });
});
