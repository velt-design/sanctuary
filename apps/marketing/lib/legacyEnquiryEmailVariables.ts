/** New saved designs still reach staff when the production V2 email switch is off.
 * Historical variables without a brief pass through unchanged. */
import { formatEstimateMoney, readConfiguredEstimate } from '../emails/ConfiguredEstimate';

export function legacyEnquiryEmailVariables(variables: Record<string, unknown>): Record<string, unknown> {
  const brief = variables.customerBrief as { summary?: string } | undefined;
  if (!brief?.summary) return variables;
  const estimate = readConfiguredEstimate(variables.configuredEstimate);
  const estimateText = estimate ? [
    `Submitted installed estimate: ${formatEstimateMoney(estimate.amountIncGst)} NZD including GST. Subject to site confirmation.`,
    ...estimate.breakdown.map(line => `${line.label}: ${formatEstimateMoney(line.amountIncGst)}`),
  ].join('\n') : undefined;
  return {
    ...variables,
    message: [variables.message, `Submitted design: ${brief.summary}`, estimateText, variables.submittedDesignUrl]
      .filter(Boolean).join('\n\n'),
  };
}
