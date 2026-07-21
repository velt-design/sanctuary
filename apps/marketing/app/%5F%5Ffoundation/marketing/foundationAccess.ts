export function shouldShowMarketingFoundation({ nodeEnv, enabled }: { nodeEnv: string | undefined; enabled: string | undefined }) {
  return nodeEnv === 'development' || enabled === 'true';
}
