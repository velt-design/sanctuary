import type { ReactNode } from 'react';
import { getProductComparisonTable } from '../../lib/productComparisonTable.server';
import PergolaSelection from './PergolaSelection';

export default async function ProductComparisonSelection({ comparison }: { comparison: ReactNode }) {
  return <PergolaSelection comparison={comparison} table={await getProductComparisonTable()} />;
}
