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
  title: 'Enquiry email workbench',
  description:
    'Choose a project scenario, compare three exact email designs, then send labelled proofs to the fixed review inbox.',
} as const;

export default function EmailPreviewWorkbenchPage({
  previewEndpoint,
  qaFixture = false,
}: EmailPreviewWorkbenchPageProps = {}) {
  return (
    <PageLayout
      width="full"
      data-ui-foundation-consumer="email-previews"
      data-portal-page-shell="email-previews"
      data-portal-page-shell-ready="true"
    >
      <div data-portal-shell-region="email-previews-header">
        {qaFixture ? (
          <PageHeader {...headerProps} />
        ) : (
          <StaffPageHeader {...headerProps} searchShortcutEnabled={false} />
        )}
      </div>
      <EmailPreviewClient previewEndpoint={previewEndpoint} />
    </PageLayout>
  );
}
