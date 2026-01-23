import { ACTIVE_COSTING_MANIFEST_PATH, loadCostingConfigV1 } from '@/src/costing/engine/config';
import ActionsClient from './ActionsClient';

export const runtime = 'nodejs';

export default function AdminActionsPage() {
  const cfg = loadCostingConfigV1();

  return (
    <ActionsClient
      loadedFrom={ACTIVE_COSTING_MANIFEST_PATH}
      sourceFile={`src/costing/config/${cfg.manifest.files.install_actions}`}
      actions={cfg.installActions.actions as any}
    />
  );
}

