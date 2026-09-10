/** New saved designs still reach staff when the production V2 email switch is off.
 * Historical variables without a brief pass through unchanged. */
export function legacyEnquiryEmailVariables(variables: Record<string, unknown>): Record<string, unknown> {
  const brief = variables.customerBrief as { summary?: string } | undefined;
  if (!brief?.summary) return variables;
  return {
    ...variables,
    message: [variables.message, `Submitted design: ${brief.summary}`, variables.submittedDesignUrl]
      .filter(Boolean).join('\n\n'),
  };
}
