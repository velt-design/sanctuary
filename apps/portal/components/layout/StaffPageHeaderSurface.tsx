'use client';

import PageHeader, { type PageHeaderProps } from './PageHeader';
import GlobalPortalSearch from './GlobalPortalSearchSurface';
import type { ReactNode } from 'react';

export type StaffPageHeaderProps = Omit<PageHeaderProps, 'utility'> & {
  searchShortcutEnabled?: boolean;
};

export default function StaffPageHeaderSurface({
  searchShortcutEnabled = true,
  search,
  ...headerProps
}: StaffPageHeaderProps & { search?: ReactNode }) {
  return (
    <PageHeader
      {...headerProps}
      utility={search ?? <GlobalPortalSearch shortcutEnabled={searchShortcutEnabled} />}
    />
  );
}
