import { getCostingConfigWithOverrides } from '@/lib/costing/overrides';
import { ACTIVE_COSTING_MANIFEST_PATH } from '@/src/costing/engine/config';
import PricebookHub from './PricebookHub';

export const runtime = 'nodejs';

export default async function PricebookPage() {
  const { config, overrides } = await getCostingConfigWithOverrides();
  const files = config.manifest.files;

  return (
    <PricebookHub
      loadedFrom={ACTIVE_COSTING_MANIFEST_PATH}
      materialsSourceFile={`src/costing/config/${files.pricebook_materials}`}
      actionsSourceFile={`src/costing/config/${files.install_actions}`}
      overheadsSourceFile={`src/costing/config/${files.overheads}`}
      materials={config.materials.items as any}
      actions={config.installActions.actions as any}
      overheads={config.overheads as any}
      materialOverrides={overrides.materialCostOverrides}
      actionOverrides={overrides.actionMinutesOverrides}
    />
  );
}
