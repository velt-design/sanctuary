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
        title="Enquiry email comparison"
        description="Compare three production-capable layouts with synchronized enquiry data, responsive sizes and controlled light or dark inbox previews."
        searchShortcutEnabled={false}
      />
      <EmailPreviewClient />
    </PageLayout>
  );
}
