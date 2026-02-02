import { getCostingConfigWithOverrides } from '@/lib/costing/overrides';
import { ACTIVE_COSTING_MANIFEST_PATH } from '@sp/costing';
import PricebookHub from './PricebookHub';

export const runtime = 'nodejs';

export default async function PricebookPage() {
  const { config, overrides } = await getCostingConfigWithOverrides();
  const files = config.manifest.files;

  return (
    <PricebookHub
      loadedFrom={ACTIVE_COSTING_MANIFEST_PATH}
      materialsSourceFile={`packages/costing/src/config/${files.pricebook_materials}`}
      actionsSourceFile={`packages/costing/src/config/${files.install_actions}`}
      overheadsSourceFile={`packages/costing/src/config/${files.overheads}`}
      materials={config.materials.items as any}
      actions={config.installActions.actions as any}
      overheads={config.overheads as any}
      materialOverrides={overrides.materialCostOverrides}
      actionOverrides={overrides.actionMinutesOverrides}
    />
  );
}
