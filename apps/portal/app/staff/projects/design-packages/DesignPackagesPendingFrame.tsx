import SpreadsheetPendingFrame from '@/components/spreadsheet/SpreadsheetPendingFrame';
import { DESIGN_LIST_COLUMNS } from '@/lib/designPackages/columns';

export default function DesignPackagesPendingFrame() {
  return (
    <SpreadsheetPendingFrame
      route="design-list"
      title="Drafting Queue"
      columns={DESIGN_LIST_COLUMNS}
    />
  );
}
