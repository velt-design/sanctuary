import localFont from 'next/font/local';
import { getDesignBookletContentCatalog } from '@/lib/designBooklets/marketingContent';
import DesignBookletWorkbenchClient from './DesignBookletWorkbenchClient';

const instrumentSans = localFont({
  src: '../../../assets/fonts/InstrumentSans-Variable.woff2',
  display: 'swap',
  variable: '--font-design-booklet-instrument',
});

type Props = {
  pdfEndpoint?: string;
  projectId?: string;
  qaFixture?: boolean;
};

export default function DesignBookletWorkbenchPage({
  pdfEndpoint = '/api/staff/v1/design-booklets/pdf',
  projectId,
  qaFixture = false,
}: Props) {
  return (
    <div className={instrumentSans.variable}>
      <DesignBookletWorkbenchClient
        key={projectId ?? 'standalone'}
        content={getDesignBookletContentCatalog()}
        pdfEndpoint={pdfEndpoint}
        projectId={projectId}
        qaFixture={qaFixture}
      />
    </div>
  );
}
