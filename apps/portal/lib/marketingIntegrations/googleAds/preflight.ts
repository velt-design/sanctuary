import { z } from 'zod';
import { searchAds, type AdsRead } from './report';
import { GoogleFailure } from './transport';
/** Read-only provider preflight. Never creates an action or changes campaign goals. */
export async function checkSaleDestination(input: AdsRead & { conversionCustomerId: string; actionId: string }) {
  const account = z.array(z.object({ customer: z.object({ id: z.literal(input.customerId),
    conversionTrackingSetting: z.object({ googleAdsConversionCustomer: z.string() }) }) })).length(1).parse(await searchAds(input,
    'SELECT customer.id, customer.conversion_tracking_setting.google_ads_conversion_customer FROM customer'))[0].customer;
  if (account.conversionTrackingSetting.googleAdsConversionCustomer !== `customers/${input.conversionCustomerId}`) throw new GoogleFailure('CONVERSION_OWNER_CHANGED');
  const rows = await searchAds({ ...input, customerId: input.conversionCustomerId },
    `SELECT conversion_action.id, conversion_action.type, conversion_action.status, conversion_action.category, conversion_action.primary_for_goal, conversion_action.counting_type, conversion_action.value_settings.always_use_default_value, conversion_action.click_through_lookback_window_days FROM conversion_action WHERE conversion_action.id = ${z.string().regex(/^[1-9]\d{0,19}$/).parse(input.actionId)}`);
  const action = z.array(z.object({ conversionAction: z.object({ id: z.literal(input.actionId), type: z.literal('UPLOAD_CLICKS'), status: z.literal('ENABLED'), category: z.literal('PURCHASE'),
    primaryForGoal: z.literal(false), countingType: z.literal('MANY_PER_CLICK'), valueSettings: z.object({ alwaysUseDefaultValue: z.literal(false) }),
    clickThroughLookbackWindowDays: z.union([z.string().regex(/^\d+$/),z.number()]).transform(Number).pipe(z.number().int().min(1).max(90)) }) })).length(1).parse(rows)[0].conversionAction;
  return { owner: input.conversionCustomerId, actionId: action.id, clickWindowDays: action.clickThroughLookbackWindowDays };
}
