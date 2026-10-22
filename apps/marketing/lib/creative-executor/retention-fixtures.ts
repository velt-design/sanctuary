import {randomUUID} from 'node:crypto';
import {canonicalHash,creativeAssetHash,executionPlanSchema} from './contract';
import {nativeWindow} from './window';
const creativeScope={app:'11',business:'13',account:'14',page:'15'},scope={campaign:'16',adset:'17',ads:['21','22','23','24'].map(id=>({id}))};
const config=()=>({enrollment:{systemUser:'12'}}),settings=()=>({id:'17'});
export function planFixture() {
  const control = { format: 'image' as const, id: '888001', page: creativeScope.page, imageHash: 'a'.repeat(32), primary: 'Approved existing hook.', headline: 'Approved heading', description: '',
    action: 'LEARN_MORE' as const, path: '/acrylic-roof-pergolas-auckland' as const,
    urlTags: 'utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}' as const };
  const principal = config().enrollment.systemUser;
  const planScope = { app: creativeScope.app, business: creativeScope.business, account: creativeScope.account, page: creativeScope.page, principal, campaign: scope.campaign, adset: scope.adset };
  const preStateHash = canonicalHash({ scope: planScope, dailyMinor: 40000, adset: settings(),
    originals: scope.ads.map(row => ({ id: row.id, status: 'ACTIVE', pageMatches: true })), creative: control });
  const {start,end} = nativeWindow(new Date(Date.now()+2*86400000).toISOString().slice(0,10));
  return executionPlanSchema.parse({ version: 1, landingTemplate: 'e'.repeat(64), purpose: 'formal_experiment', experiment: randomUUID(), scope: planScope, originalAds: scope.ads.map(row => row.id), controlAd: scope.ads[3]!.id, control, adTracking: [], nativeObjective: { type: 'CONVERSIONS', is_primary: true, name: 'Website Lead', adspixels: [{ id: '777', event_names: ['Lead'] }] },
    challengerPrimary: 'Approved alternative hook.', approvedAssetHash: creativeAssetHash(control),
    approvedCopyHash: canonicalHash({ control: control.primary, challenger: 'Approved alternative hook.' }), approvalHash: 'b'.repeat(64), evidenceHash: 'c'.repeat(64),
    generator: 'resp_fixture_author', reviewer: 'resp_fixture_reviewer', approvedAt: new Date(Date.now() - 60000).toISOString(), approvalUntil: new Date(Date.now() + 20 * 86400_000).toISOString(),
    start, end, dailyMinor: 40000, weeklyMinor: 280000, studyDailyMinor: 8000, currency: 'NZD', timezone: 'Pacific/Auckland', nativeContractHash: 'd'.repeat(64), preStateHash,
    evaluation: { primary: 'genuine_saved_enquiries_per_actual_NZD', interval: 'exact_conditional_poisson_rate_ratio_95', providerEvent: 'website_lead', durationDays: 14, maturationHours: 72, formalAnalyses: 1, qualityMinimumEach: 5, qualityCoverageMinimum: 0.5, maximumCoverageGap: 0.2, unknownMeans: 'inconclusive' } });
}
