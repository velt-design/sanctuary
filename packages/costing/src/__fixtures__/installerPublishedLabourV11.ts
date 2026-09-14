import {loadCostingConfigV1} from '../engine/config';
// Read-only Version 11 labour values observed in the published portal, 11 Sep 2026.
// This is a validation fixture, never a runtime pricebook or a material-price snapshot.
export function publishedLabourFixture(){
 const c=structuredClone(loadCostingConfigV1()); c.appliedControlManifestVersion='v2.6';
 const overrides:Record<string,number>={
 'mob.site_safety':15,'mob.client_briefing':15,'mob.offload_materials':10,
 'posts.deck_bracket_per_post':15,'posts.slab_anchor_per_post':20,'posts.pile_1m_per_post':35,'posts.pile_1_5m_per_post':45,
 'house.install_back_stringer_startup':20,'house.install_fascia_connection':10,
 'frame.overhang_support_beam_m':6,'frame.overhang_stringer_m':8,'finish.fit_end_caps_overhang':9,
 'finish.final_clean':45,'demob.rubbish':60,'roof.install_purlins_m':5,'roof.install_insulated_panels_m2':7,'roof.install_steel_corrugated_m2':11
 };
 for(const a of c.installActions.actions) if(a.id in overrides) a.base_minutes=overrides[a.id] as typeof a.base_minutes;
 return c;
}
