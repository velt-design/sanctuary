'use client';

import SpreadsheetPageTemplate from '@/components/spreadsheet/SpreadsheetPageTemplate';
import { useDesignListSpreadsheetAdapter } from './useDesignListSpreadsheetAdapter';

export default function DesignPackagesClient({loader,readOnly=false}:{loader?:()=>Promise<import('@/lib/designPackages/types').DesignPackagesResponse>;readOnly?:boolean}={}) {
  const adapter = useDesignListSpreadsheetAdapter({loader,readOnly});
  return <SpreadsheetPageTemplate adapter={adapter} />;
}
