import {
  bespokeExplanations,
  commercialExplanation,
  coverExplanations,
  guidedQuestions,
  outdoorExplanations,
  professionalExplanation,
  resultCtaLabels,
  resultRoutes,
  resultTitles,
} from './guidedConversationContent';
import {
  GUIDED_HOME_PATH,
  GUIDED_HOME_VARIANT,
  guidedAudiences,
  guidedBusinessRoles,
  guidedBusinessSectors,
  guidedCoverFocuses,
  guidedHomeGoals,
  guidedOutdoorUses,
  guidedProfessionalNeeds,
  guidedProfessionalStages,
  guidedSiteConstraints,
  isGuidedValue,
  type GuidedAudience,
  type GuidedBusinessRole,
  type GuidedBusinessSector,
  type GuidedCoverFocus,
  type GuidedHomeGoal,
  type GuidedOutdoorUse,
  type GuidedProfessionalNeed,
  type GuidedProfessionalStage,
  type GuidedResultId,
  type GuidedSiteConstraint,
} from '@/lib/guidedJourneyContract';

export {
  GUIDED_HOME_PATH,
  GUIDED_HOME_VARIANT,
  guidedBusinessRoles,
  guidedBusinessSectors,
  guidedCoverFocuses,
  guidedOutdoorUses,
  guidedProfessionalNeeds,
  guidedProfessionalStages,
  guidedSiteConstraints,
};
export type {
  GuidedBusinessSector,
  GuidedResultId,
};

export type GuidedAnswerValue =
  | GuidedAudience
  | GuidedHomeGoal
  | GuidedCoverFocus
  | GuidedOutdoorUse
  | GuidedSiteConstraint
  | GuidedBusinessSector
  | GuidedBusinessRole
  | GuidedProfessionalStage
  | GuidedProfessionalNeed;

export type GuidedQuestionId =
  | 'audience'
  | 'home-goal'
  | 'home-cover-focus'
  | 'home-outdoor-use'
  | 'home-site-constraint'
  | 'business-sector'
  | 'business-role'
  | 'professional-stage'
  | 'professional-need';

export type GuidedConversationState = {
  audience?: GuidedAudience;
  goal?: GuidedHomeGoal;
  focus?: GuidedCoverFocus;
  use?: GuidedOutdoorUse;
  constraint?: GuidedSiteConstraint;
  sector?: GuidedBusinessSector;
  role?: GuidedBusinessRole;
  stage?: GuidedProfessionalStage;
  need?: GuidedProfessionalNeed;
};

type GuidedOption = {
  value: GuidedAnswerValue;
  label: string;
  description: string;
};

export type GuidedQuestion = {
  id: GuidedQuestionId;
  eyebrow: string;
  title: string;
  treatment: 'type-led' | 'image-led';
  step: 1 | 2 | 3;
  options: readonly GuidedOption[];
};

export type GuidedResult = {
  id: GuidedResultId;
  title: string;
  explanation: string;
  evidenceLabel: string;
  destination: string;
  destinationRoute: string;
  ctaLabel: string;
  focusId: string;
  audience: GuidedAudience;
  answerPath: readonly string[];
};

export type GuidedSummaryItem = {
  questionId: GuidedQuestionId;
  questionTitle: string;
  answerId: GuidedAnswerValue;
  answerLabel: string;
  step: 1 | 2 | 3;
};

export type GuidedScreen =
  | { kind: 'question'; id: GuidedQuestionId }
  | { kind: 'result'; result: GuidedResult };

export type GuidedSearchParamReader = {
  get(name: string): string | null;
};

function isKnownValue<const T extends readonly string[]>(
  values: T,
  value: string | null,
): value is T[number] {
  return isGuidedValue(values, value);
}

function optionFor(
  questionId: GuidedQuestionId,
  answer: GuidedAnswerValue,
): GuidedOption | undefined {
  return guidedQuestions[questionId].options.find(
    (option) => option.value === answer,
  );
}

export function getGuidedQuestion(id: GuidedQuestionId): GuidedQuestion {
  return guidedQuestions[id];
}

export function getAllGuidedQuestions(): readonly GuidedQuestion[] {
  return Object.values(guidedQuestions);
}

export function parseGuidedConversationState(
  params: GuidedSearchParamReader,
): GuidedConversationState {
  const audience = params.get('audience');
  if (!isKnownValue(guidedAudiences, audience)) return {};

  if (audience === 'home') {
    const goal = params.get('goal');
    if (!isKnownValue(guidedHomeGoals, goal)) return { audience };

    if (goal === 'straightforward-cover') {
      const focus = params.get('focus');
      return isKnownValue(guidedCoverFocuses, focus)
        ? { audience, goal, focus }
        : { audience, goal };
    }
    if (goal === 'outdoor-room') {
      const use = params.get('use');
      return isKnownValue(guidedOutdoorUses, use)
        ? { audience, goal, use }
        : { audience, goal };
    }

    const constraint = params.get('constraint');
    return isKnownValue(guidedSiteConstraints, constraint)
      ? { audience, goal, constraint }
      : { audience, goal };
  }

  if (audience === 'business') {
    const sector = params.get('sector');
    if (!isKnownValue(guidedBusinessSectors, sector)) return { audience };
    const role = params.get('role');
    return isKnownValue(guidedBusinessRoles, role)
      ? { audience, sector, role }
      : { audience, sector };
  }

  const stage = params.get('stage');
  if (!isKnownValue(guidedProfessionalStages, stage)) return { audience };
  const need = params.get('need');
  return isKnownValue(guidedProfessionalNeeds, need)
    ? { audience, stage, need }
    : { audience, stage };
}

export function parseGuidedConversationRecord(
  record: Record<string, string | string[] | undefined>,
): GuidedConversationState {
  return parseGuidedConversationState({
    get(name) {
      const value = record[name];
      return typeof value === 'string' ? value : null;
    },
  });
}

export function getGuidedScreen(state: GuidedConversationState): GuidedScreen {
  if (!state.audience) return { kind: 'question', id: 'audience' };

  if (state.audience === 'home') {
    if (!state.goal) return { kind: 'question', id: 'home-goal' };
    if (state.goal === 'straightforward-cover' && !state.focus) {
      return { kind: 'question', id: 'home-cover-focus' };
    }
    if (state.goal === 'outdoor-room' && !state.use) {
      return { kind: 'question', id: 'home-outdoor-use' };
    }
    if (state.goal === 'difficult-site' && !state.constraint) {
      return { kind: 'question', id: 'home-site-constraint' };
    }
  }

  if (state.audience === 'business') {
    if (!state.sector) return { kind: 'question', id: 'business-sector' };
    if (!state.role) return { kind: 'question', id: 'business-role' };
  }

  if (state.audience === 'professional') {
    if (!state.stage) return { kind: 'question', id: 'professional-stage' };
    if (!state.need) return { kind: 'question', id: 'professional-need' };
  }

  const result = getGuidedResult(state);
  return result
    ? { kind: 'result', result }
    : { kind: 'question', id: 'audience' };
}

export function answerGuidedQuestion(
  state: GuidedConversationState,
  questionId: GuidedQuestionId,
  answer: GuidedAnswerValue,
): GuidedConversationState {
  const screen = getGuidedScreen(state);
  if (screen.kind !== 'question' || screen.id !== questionId) return state;
  if (!optionFor(questionId, answer)) return state;

  switch (questionId) {
    case 'audience':
      return { audience: answer as GuidedAudience };
    case 'home-goal':
      return { audience: 'home', goal: answer as GuidedHomeGoal };
    case 'home-cover-focus':
      return {
        audience: 'home',
        goal: 'straightforward-cover',
        focus: answer as GuidedCoverFocus,
      };
    case 'home-outdoor-use':
      return {
        audience: 'home',
        goal: 'outdoor-room',
        use: answer as GuidedOutdoorUse,
      };
    case 'home-site-constraint':
      return {
        audience: 'home',
        goal: 'difficult-site',
        constraint: answer as GuidedSiteConstraint,
      };
    case 'business-sector':
      return { audience: 'business', sector: answer as GuidedBusinessSector };
    case 'business-role':
      return {
        audience: 'business',
        sector: state.sector,
        role: answer as GuidedBusinessRole,
      };
    case 'professional-stage':
      return {
        audience: 'professional',
        stage: answer as GuidedProfessionalStage,
      };
    case 'professional-need':
      return {
        audience: 'professional',
        stage: state.stage,
        need: answer as GuidedProfessionalNeed,
      };
  }
}

export function changeGuidedAnswer(
  state: GuidedConversationState,
  questionId: GuidedQuestionId,
): GuidedConversationState {
  if (questionId === 'audience') return {};
  if (
    questionId === 'home-goal'
    || questionId === 'business-sector'
    || questionId === 'professional-stage'
  ) {
    return state.audience ? { audience: state.audience } : {};
  }
  if (questionId === 'home-cover-focus') {
    return { audience: 'home', goal: 'straightforward-cover' };
  }
  if (questionId === 'home-outdoor-use') {
    return { audience: 'home', goal: 'outdoor-room' };
  }
  if (questionId === 'home-site-constraint') {
    return { audience: 'home', goal: 'difficult-site' };
  }
  if (questionId === 'business-role' && state.sector) {
    return { audience: 'business', sector: state.sector };
  }
  if (questionId === 'professional-need' && state.stage) {
    return { audience: 'professional', stage: state.stage };
  }
  return {};
}

export function getGuidedSummaryItems(
  state: GuidedConversationState,
): GuidedSummaryItem[] {
  const selections: Array<[GuidedQuestionId, GuidedAnswerValue | undefined]> = [
    ['audience', state.audience],
  ];

  if (state.audience === 'home') {
    selections.push(['home-goal', state.goal]);
    if (state.goal === 'straightforward-cover') {
      selections.push(['home-cover-focus', state.focus]);
    } else if (state.goal === 'outdoor-room') {
      selections.push(['home-outdoor-use', state.use]);
    } else if (state.goal === 'difficult-site') {
      selections.push(['home-site-constraint', state.constraint]);
    }
  } else if (state.audience === 'business') {
    selections.push(['business-sector', state.sector]);
    selections.push(['business-role', state.role]);
  } else if (state.audience === 'professional') {
    selections.push(['professional-stage', state.stage]);
    selections.push(['professional-need', state.need]);
  }

  return selections.flatMap(([questionId, answer]) => {
    if (!answer) return [];
    const question = getGuidedQuestion(questionId);
    const option = optionFor(questionId, answer);
    return option
      ? [{
          questionId,
          questionTitle: question.title,
          answerId: answer,
          answerLabel: option.label,
          step: question.step,
        }]
      : [];
  });
}

export function getGuidedAnswerPath(
  state: GuidedConversationState,
): string[] {
  return getGuidedSummaryItems(state).map((item) => item.answerId);
}

export function getGuidedProgress(
  state: GuidedConversationState,
): { current: 1 | 2 | 3; total: 3 } {
  const screen = getGuidedScreen(state);
  return {
    current: screen.kind === 'question'
      ? getGuidedQuestion(screen.id).step
      : 3,
    total: 3,
  };
}

export function buildGuidedHomeHref(
  state: GuidedConversationState,
): string {
  const params = new URLSearchParams();
  if (state.audience) params.set('audience', state.audience);

  if (state.audience === 'home' && state.goal) {
    params.set('goal', state.goal);
    if (state.goal === 'straightforward-cover' && state.focus) {
      params.set('focus', state.focus);
    } else if (state.goal === 'outdoor-room' && state.use) {
      params.set('use', state.use);
    } else if (state.goal === 'difficult-site' && state.constraint) {
      params.set('constraint', state.constraint);
    }
  } else if (state.audience === 'business' && state.sector) {
    params.set('sector', state.sector);
    if (state.role) params.set('role', state.role);
  } else if (state.audience === 'professional' && state.stage) {
    params.set('stage', state.stage);
    if (state.need) params.set('need', state.need);
  }

  const query = params.toString();
  return query ? `${GUIDED_HOME_PATH}?${query}` : GUIDED_HOME_PATH;
}

export function buildGuidedReturnHref(
  state: GuidedConversationState,
): string {
  return buildGuidedHomeHref(state);
}

export function getGuidedResult(
  state: GuidedConversationState,
): GuidedResult | null {
  let id: GuidedResultId;
  let explanation: string;
  let focusId: string;
  const destinationParams = new URLSearchParams();

  if (
    state.audience === 'home'
    && state.goal === 'straightforward-cover'
    && state.focus
  ) {
    id = 'residential-cover';
    explanation = coverExplanations[state.focus];
    focusId = state.focus;
    destinationParams.set('focus', state.focus);
  } else if (
    state.audience === 'home'
    && state.goal === 'outdoor-room'
    && state.use
  ) {
    id = 'outdoor-room';
    explanation = outdoorExplanations[state.use];
    focusId = state.use;
    destinationParams.set('use', state.use);
  } else if (
    state.audience === 'home'
    && state.goal === 'difficult-site'
    && state.constraint
  ) {
    id = 'bespoke';
    explanation = bespokeExplanations[state.constraint];
    focusId = state.constraint;
    destinationParams.set('constraint', state.constraint);
  } else if (
    state.audience === 'business'
    && state.sector
    && state.role
  ) {
    id = 'commercial';
    explanation = commercialExplanation(state.sector, state.role);
    focusId = state.role;
    destinationParams.set('sector', state.sector);
    destinationParams.set('role', state.role);
  } else if (
    state.audience === 'professional'
    && state.stage
    && state.need
  ) {
    id = 'professional';
    explanation = professionalExplanation(state.stage, state.need);
    focusId = state.need;
    destinationParams.set('stage', state.stage);
    destinationParams.set('need', state.need);
  } else {
    return null;
  }

  const summaries = getGuidedSummaryItems(state);
  const destinationRoute = resultRoutes[id];
  return {
    id,
    title: resultTitles[id],
    explanation,
    evidenceLabel: summaries.at(-1)?.answerLabel ?? focusId,
    destination: `${destinationRoute}?${destinationParams.toString()}`,
    destinationRoute,
    ctaLabel: resultCtaLabels[id],
    focusId,
    audience: state.audience,
    answerPath: summaries.map((item) => item.answerId),
  };
}

export function buildGuidedDestinationHref(
  state: GuidedConversationState,
): string | null {
  return getGuidedResult(state)?.destination ?? null;
}
