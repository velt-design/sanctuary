import { getSupabaseServerAuth } from '@/lib/supabase/serverClient';
import { getCostingConfigWithOverrides } from '@/lib/costing/overrides';
import { ACTIVE_COSTING_MANIFEST_PATH } from '@sp/costing';
import PricebookHub from './PricebookHub';

export const runtime = 'nodejs';

export default async function PricebookPage() {
  const supabase = await getSupabaseServerAuth();
  const { config, overrides } = await getCostingConfigWithOverrides(supabase);
  const files = config.manifest.files;

  return (
    <PricebookHub
      loadedFrom={ACTIVE_COSTING_MANIFEST_PATH}
      materialsSourceFile={`packages/costing/src/config/${files.pricebook_materials}`}
      actionsSourceFile={`packages/costing/src/config/${files.install_actions}`}
      overheadsSourceFile={`packages/costing/src/config/${files.overheads}`}
      materials={config.materials.items as any}
      actions={config.installActions.actions as any}
      driverCurves={{
        rafter_length_loading_curve: {
          key: 'rafter_length_loading_curve',
          label: 'Rafter Length Loading Curve',
          notes: String((config.installActions.driver_rules_reference as any).rafter_length_loading_curve?.notes ?? ''),
          points: Array.isArray((config.installActions.driver_rules_reference as any).rafter_length_loading_curve?.points)
            ? ((config.installActions.driver_rules_reference as any).rafter_length_loading_curve.points as Array<{
                length_m: number;
                minutes_per_m: number;
              }>)
            : [],
        },
      }}
      overheads={config.overheads as any}
      materialOverrides={overrides.materialCostOverrides}
      actionOverrides={overrides.actionMinutesOverrides}
      driverCurveOverrides={overrides.driverCurveOverrides}
      isAdmin={true}
    />
  );
}
