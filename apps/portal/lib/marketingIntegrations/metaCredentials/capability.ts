/** Declared capability names are not runtime grants. Creative execution has no
 * credential loader, provider adapter or activation path in this policy stage. */
export type MetaCredentialCapability = 'reports' | 'sales' | 'creatives';
export type RuntimeMetaCredentialCapability = Exclude<MetaCredentialCapability, 'creatives'>;
