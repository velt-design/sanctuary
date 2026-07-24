import type { Metadata } from 'next';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { PageLayout } from '@/components/ui/foundation';
import EmailPreviewClient from './EmailPreviewClient';

export const metadata: Metadata = {
  title: 'Enquiry email previews | Sanctuary Staff Portal',
};

export default function EmailPreviewsPage() {
  return (
    <PageLayout width="full" data-ui-foundation-consumer="email-previews">
      <StaffPageHeader
        variant="detail"
        eyebrow="Marketing"
        title="Enquiry email previews"
        description="Review the fixture-based customer email and send the exact rendered version to the configured staging inbox."
        searchShortcutEnabled={false}
      />
      <EmailPreviewClient />
    </PageLayout>
  );
}
