'use client';

import StaffPageHeaderSurface, { type StaffPageHeaderProps } from './StaffPageHeaderSurface';
import GlobalPortalSearch from './GlobalPortalSearch.client';

export default function StaffPageHeader({
  searchShortcutEnabled = true,
  ...headerProps
}: StaffPageHeaderProps) {
  return (
    <StaffPageHeaderSurface
      {...headerProps}
      searchShortcutEnabled={searchShortcutEnabled}
      search={<GlobalPortalSearch shortcutEnabled={searchShortcutEnabled} />}
    />
  );
}
