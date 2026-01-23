import { ACTIVE_COSTING_MANIFEST_PATH, loadCostingConfigV1 } from '@/src/costing/engine/config';
import OverheadsClient from './OverheadsClient';

export const runtime = 'nodejs';

export default function AdminOverheadsPage() {
  const cfg = loadCostingConfigV1();

  return (
    <OverheadsClient
      loadedFrom={ACTIVE_COSTING_MANIFEST_PATH}
      sourceFile={`src/costing/config/${cfg.manifest.files.overheads}`}
      overheads={cfg.overheads as any}
    />
  );
}

