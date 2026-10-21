'use client';

import { Drawer as PortalDrawer, type DrawerProps } from '@/components/ui/drawer/Drawer';
import theme from './MarketingTheme.module.css';

/** Keep the report's local palette across the document-body portal boundary. */
export function Drawer({ className, ...props }: DrawerProps) {
  return <PortalDrawer {...props} className={[theme.theme, theme.drawer, className].filter(Boolean).join(' ')} />;
}
