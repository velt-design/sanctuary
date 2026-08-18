import { createDefaultCustomerPergolaConfigurationV1 } from './defaults';

const TEST_CONFIGURATION_ID = '123e4567-e89b-42d3-a456-426614174000';
const TEST_TIMESTAMP = '2026-08-17T00:00:00.000Z';

export function createTestCustomerConfiguration() {
  return createDefaultCustomerPergolaConfigurationV1({
    configurationId: TEST_CONFIGURATION_ID,
    timestamp: TEST_TIMESTAMP,
  });
}
