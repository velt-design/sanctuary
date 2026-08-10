'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { CalculatorIssue } from './calculatorIssueNavigation';
import {
  revealAndFocusCalculatorTarget,
  scheduleCalculatorLayoutTask,
} from './calculatorViewportNavigation';

export function useCalculatorIssueNavigation({
  activeModuleIndex,
  setActiveModuleIndex,
}: {
  activeModuleIndex: number;
  setActiveModuleIndex: (moduleIndex: number) => void;
}) {
  const [issuesOpen, setIssuesOpen] = useState(false);
  const pendingIssueFocusRef = useRef<{ moduleIndex: number; fieldId: string } | null>(null);

  useEffect(() => {
    if (issuesOpen) return;
    const pending = pendingIssueFocusRef.current;
    if (!pending) return;
    if (pending.moduleIndex !== activeModuleIndex) return;
    pendingIssueFocusRef.current = null;

    return scheduleCalculatorLayoutTask(() => {
      const element = document.getElementById(pending.fieldId);
      if (!element) return;
      revealAndFocusCalculatorTarget(element);
    });
  }, [activeModuleIndex, issuesOpen]);

  const openIssues = useCallback(() => setIssuesOpen(true), []);
  const closeIssues = useCallback(() => setIssuesOpen(false), []);
  const selectIssue = useCallback(
    (issue: CalculatorIssue) => {
      pendingIssueFocusRef.current = { moduleIndex: issue.moduleIndex, fieldId: issue.fieldId };
      setActiveModuleIndex(issue.moduleIndex);
      setIssuesOpen(false);
    },
    [setActiveModuleIndex],
  );

  return {
    issuesOpen,
    openIssues,
    closeIssues,
    selectIssue,
  };
}
