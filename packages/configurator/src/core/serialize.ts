import type { CustomerPergolaConfigurationV1 } from './contracts';
import { normalizeCustomerPergolaConfigurationV1 } from './normalize';
import { parseCustomerPergolaConfigurationV1 } from './parser';

export function serializeCustomerPergolaConfigurationV1(
  configuration: CustomerPergolaConfigurationV1,
): string {
  const normalized = normalizeCustomerPergolaConfigurationV1(configuration);
  return JSON.stringify(parseCustomerPergolaConfigurationV1(normalized));
}
