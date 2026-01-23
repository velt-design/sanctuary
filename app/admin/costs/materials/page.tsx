import { ACTIVE_COSTING_MANIFEST_PATH, loadCostingConfigV1 } from '@/src/costing/engine/config';
import MaterialsClient from './MaterialsClient';

export const runtime = 'nodejs';

export default function AdminMaterialsPage() {
  const cfg = loadCostingConfigV1();

  return (
    <MaterialsClient
      loadedFrom={ACTIVE_COSTING_MANIFEST_PATH}
      sourceFile={`src/costing/config/${cfg.manifest.files.pricebook_materials}`}
      items={cfg.materials.items as any}
    />
  );
}

