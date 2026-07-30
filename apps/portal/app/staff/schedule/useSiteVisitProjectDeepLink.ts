'use client';

import { useEffect, useRef } from 'react';
import type {
  SiteVisitCalendarItem,
  SiteVisitProjectFocus,
} from '@/lib/types/siteVisits';

type SiteVisitProjectDeepLinkParams = {
  projectTargetId: string | null;
  focus: SiteVisitProjectFocus | null;
  focusWeek: string | null;
  viewWeek: string;
  highlightId: string | null;
  salesOwnerId: string | null;
  searchParamsString: string;
  replace: (href: string) => void;
  onOpenScheduled: (item: SiteVisitCalendarItem) => void;
  onOpenCreate: (item: SiteVisitCalendarItem) => void;
};

export function useSiteVisitProjectDeepLink({
  projectTargetId,
  focus,
  focusWeek,
  viewWeek,
  highlightId,
  salesOwnerId,
  searchParamsString,
  replace,
  onOpenScheduled,
  onOpenCreate,
}: SiteVisitProjectDeepLinkParams): void {
  const handledProjectTargetRef = useRef<string | null>(null);
  const navigatingToRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onOpenScheduled, onOpenCreate });

  useEffect(() => {
    callbacksRef.current = { onOpenScheduled, onOpenCreate };
  }, [onOpenCreate, onOpenScheduled]);

  useEffect(() => {
    if (projectTargetId) return;
    handledProjectTargetRef.current = null;
    navigatingToRef.current = null;
  }, [projectTargetId]);

  useEffect(() => {
    if (!projectTargetId || !focus) return;

    if (handledProjectTargetRef.current === projectTargetId) return;

    if (focus.kind === 'scheduled') {
      if (!focusWeek) return;
      const conflictingOwner = Boolean(
        salesOwnerId && salesOwnerId !== focus.item.salespersonId,
      );
      const locationSettled = (
        viewWeek === focusWeek
        && highlightId === focus.item.id
        && !conflictingOwner
      );

      if (!locationSettled) {
        const qs = new URLSearchParams(searchParamsString);
        qs.set('view', 'site-visits');
        qs.set('project', projectTargetId);
        qs.set('week', focusWeek);
        qs.set('highlightSiteVisitId', focus.item.id);
        if (conflictingOwner) qs.delete('salesOwnerId');
        const href = `/staff/schedule?${qs.toString()}`;
        if (navigatingToRef.current !== href) {
          navigatingToRef.current = href;
          replace(href);
        }
        return;
      }

      navigatingToRef.current = null;
      handledProjectTargetRef.current = projectTargetId;
      callbacksRef.current.onOpenScheduled(focus.item);
      return;
    }

    handledProjectTargetRef.current = projectTargetId;
    callbacksRef.current.onOpenCreate(focus.item);
  }, [
    focus,
    focusWeek,
    highlightId,
    projectTargetId,
    replace,
    salesOwnerId,
    searchParamsString,
    viewWeek,
  ]);
}
