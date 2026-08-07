'use client';

import SpreadsheetPageTemplate from '@/components/spreadsheet/SpreadsheetPageTemplate';
import { useDesignListSpreadsheetAdapter } from './useDesignListSpreadsheetAdapter';

export default function DesignPackagesClient() {
  const adapter = useDesignListSpreadsheetAdapter();
  return <SpreadsheetPageTemplate adapter={adapter} routeShell="design-list" />;
}
