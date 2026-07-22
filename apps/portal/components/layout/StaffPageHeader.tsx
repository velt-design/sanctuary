'use client';

import PageHeader, { type PageHeaderProps } from './PageHeader';
import GlobalPortalSearch from './GlobalPortalSearch.client';

type StaffPageHeaderProps = Omit<PageHeaderProps, 'utility'> & {
  searchShortcutEnabled?: boolean;
};

export default function StaffPageHeader({
  searchShortcutEnabled = true,
  ...headerProps
}: StaffPageHeaderProps) {
  return (
    <PageHeader
      {...headerProps}
      utility={<GlobalPortalSearch shortcutEnabled={searchShortcutEnabled} />}
    />
  );
}
