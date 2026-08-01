'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useConsent } from '@/components/ConsentProvider';
import {
  GUIDED_HOME_PATH,
  GUIDED_HOME_VARIANT,
  buildGuidedHomeHref,
  getGuidedAnswerPath,
  getGuidedQuestion,
  type GuidedAnswerValue,
  type GuidedConversationState,
  type GuidedQuestionId,
  type GuidedResult,
  type GuidedScreen,
  type GuidedSummaryItem,
} from './guidedConversationModel';

type TrackingWindow = typeof window & {
  dataLayer?: Array<Record<string, unknown> | unknown[]>;
};

type GuidedTrackerInput = {
  state: GuidedConversationState;
  screen: GuidedScreen;
};

function viewportCategory(): 'mobile' | 'tablet' | 'desktop' {
  if (window.innerWidth <= 640) return 'mobile';
  if (window.innerWidth <= 1024) return 'tablet';
  return 'desktop';
}

function pushGuidedEvent(
  event: string,
  properties: Record<string, unknown> = {},
) {
  const trackingWindow = window as TrackingWindow;
  trackingWindow.dataLayer = trackingWindow.dataLayer || [];
  trackingWindow.dataLayer.push({
    event,
    homepage_variant: GUIDED_HOME_VARIANT,
    viewport_category: viewportCategory(),
    source_path: GUIDED_HOME_PATH,
    ...properties,
  });
}

export function useGuidedHomepageTracker({
  state,
  screen,
}: GuidedTrackerInput) {
  const { consent } = useConsent();
  const trackedViewRef = useRef(false);
  const lastTrackedScreenRef = useRef<string | null>(null);
  const stateHref = buildGuidedHomeHref(state);
  const screenKey = screen.kind === 'question'
    ? `question:${screen.id}:${stateHref}`
    : `result:${screen.result.id}:${stateHref}`;

  useEffect(() => {
    if (!consent.analytics) return;

    if (!trackedViewRef.current) {
      trackedViewRef.current = true;
      pushGuidedEvent('guided_home_view');
    }

    if (lastTrackedScreenRef.current === screenKey) return;
    lastTrackedScreenRef.current = screenKey;

    if (screen.kind === 'question') {
      const question = getGuidedQuestion(screen.id);
      pushGuidedEvent('guided_home_question_view', {
        question_id: question.id,
        step_number: question.step,
        answer_path: getGuidedAnswerPath(state),
        ...(state.audience ? { audience: state.audience } : {}),
      });
      return;
    }

    pushGuidedEvent('guided_home_result_view', {
      result_id: screen.result.id,
      focus_id: screen.result.focusId,
      audience: screen.result.audience,
      answer_path: screen.result.answerPath,
    });
  }, [consent.analytics, screen, screenKey, state]);

  const trackAnswer = useCallback((
    questionId: GuidedQuestionId,
    answerId: GuidedAnswerValue,
    nextState: GuidedConversationState,
  ) => {
    if (!consent.analytics) return;
    const question = getGuidedQuestion(questionId);
    pushGuidedEvent('guided_home_answer', {
      question_id: questionId,
      answer_id: answerId,
      step_number: question.step,
      ...(nextState.audience ? { audience: nextState.audience } : {}),
    });
  }, [consent.analytics]);

  const trackChangeAnswer = useCallback((item: GuidedSummaryItem) => {
    if (!consent.analytics) return;
    pushGuidedEvent('guided_home_change_answer', {
      question_id: item.questionId,
      previous_answer_id: item.answerId,
      step_number: item.step,
    });
  }, [consent.analytics]);

  const trackResultClick = useCallback((result: GuidedResult) => {
    if (!consent.analytics) return;
    pushGuidedEvent('guided_home_result_click', {
      result_id: result.id,
      focus_id: result.focusId,
      destination: result.destination,
    });
  }, [consent.analytics]);

  const trackReset = useCallback(() => {
    if (!consent.analytics) return;
    pushGuidedEvent('guided_home_reset');
  }, [consent.analytics]);

  return {
    trackAnswer,
    trackChangeAnswer,
    trackReset,
    trackResultClick,
  };
}
