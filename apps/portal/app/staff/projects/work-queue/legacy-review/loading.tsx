import { LoadingSkeleton, PageLayout } from '@/components/ui/foundation';

export default function LegacyContactedReviewLoading() {
  return (
    <PageLayout width="full" density="compact">
      <LoadingSkeleton rows={9} columns={4} label="Loading old Contacted project review" />
    </PageLayout>
  );
}
