import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { DetailRows, Eyebrow } from './alternatives/AlternativeEmailParts';

export function readConfiguredEstimate(value: unknown) {
  const price = value as { amountIncGst?: number; includesGst?: boolean; currency?: string; breakdown?: { label: string; amountIncGst: number }[] } | undefined;
  if (!price || price.currency !== 'NZD' || price.includesGst !== true || !Number.isSafeInteger(price.amountIncGst)
    || Number(price.amountIncGst) <= 0 || !Array.isArray(price.breakdown) || !price.breakdown.length
    || price.breakdown.some(line => !line || typeof line.label !== 'string' || !Number.isSafeInteger(line.amountIncGst) || line.amountIncGst < 0)
    || price.breakdown.reduce((sum, line) => sum + line.amountIncGst, 0) !== price.amountIncGst) return null;
  return { amountIncGst: Number(price.amountIncGst), breakdown: price.breakdown };
}
export const formatEstimateMoney = (amount: number) => `$${amount.toLocaleString('en-NZ')}`;

export function ConfiguredEstimate({ value }: { value: unknown }) {
  const price = readConfiguredEstimate(value);
  if (!price) return <Text>Your design needs a tailored quote. We’ll confirm pricing with you.</Text>;
  return <Section style={{ margin: '24px 0' }}>
    <Eyebrow>Your submitted estimate</Eyebrow>
    <Text style={{ fontSize: 30, margin: '8px 0' }}>{formatEstimateMoney(price.amountIncGst)}</Text>
    <Text>Installed estimate · NZD including GST · Subject to site confirmation</Text>
    <DetailRows rows={price.breakdown.map(line => ({ label: line.label, value: formatEstimateMoney(line.amountIncGst) }))} />
    <Text style={{ fontSize: 12 }}>This is the estimate saved with your enquiry, including the extras listed above.</Text>
  </Section>;
}
