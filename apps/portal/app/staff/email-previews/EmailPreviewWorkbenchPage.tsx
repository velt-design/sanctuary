import PageHeader from '@/components/layout/PageHeader';
import StaffPageHeader from '@/components/layout/StaffPageHeader';
import { PageLayout } from '@/components/ui/foundation';
import EmailPreviewClient from './EmailPreviewClient';

type EmailPreviewWorkbenchPageProps = {
  previewEndpoint?: string;
  qaFixture?: boolean;
};

const headerProps = {
  variant: 'detail',
  eyebrow: 'Marketing',
  title: 'Email design workbench',
  description:
    'Review governed enquiry fixtures, compare exact customer-email renders and send clearly labelled inbox tests without touching production.',
} as const;

export default function EmailPreviewWorkbenchPage({
  previewEndpoint,
  qaFixture = false,
}: EmailPreviewWorkbenchPageProps = {}) {
  return (
    <PageLayout width="full" data-ui-foundation-consumer="email-previews">
      {qaFixture ? (
        <PageHeader {...headerProps} />
      ) : (
        <StaffPageHeader {...headerProps} searchShortcutEnabled={false} />
      )}
      <EmailPreviewClient previewEndpoint={previewEndpoint} />
    </PageLayout>
  );
}
