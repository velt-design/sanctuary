import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { DetailRows, Eyebrow } from './alternatives/AlternativeEmailParts';
import { THEME } from './theme';

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
  if (!price) return <Section className="spx-warm spx-rule" style={{ padding: '24px', backgroundColor: THEME.warm, border: `1px solid ${THEME.rule}`, margin: '24px 0' }}><Eyebrow>Your price</Eyebrow><Text className="spx-text" style={{ color: THEME.text, fontSize: 16, lineHeight: 1.65, margin: 0 }}>Your design needs a tailored quote. We’ll confirm pricing with you.</Text></Section>;
  return <Section className="spx-warm spx-rule" style={{ padding: '24px', backgroundColor: THEME.warm, border: `1px solid ${THEME.rule}`, margin: '24px 0' }}>
    <Eyebrow>Your estimated price</Eyebrow>
    <Text className="spx-text" style={{ color: THEME.text, fontSize: 34, fontWeight: 500, margin: '8px 0', lineHeight: 1.2 }}>{formatEstimateMoney(price.amountIncGst)}</Text>
    <Text className="spx-muted" style={{ color: THEME.muted, fontSize: 15, lineHeight: 1.65 }}>Total installed estimate · NZD including GST</Text>
    <DetailRows rows={price.breakdown.map(line => ({ label: line.label, value: formatEstimateMoney(line.amountIncGst) }))} />
    <Text className="spx-muted" style={{ color: THEME.muted, fontSize: 14, lineHeight: 1.65, margin: '16px 0 0' }}>All items above are included. This is not a quote; final scope and pricing are subject to site confirmation.</Text>
  </Section>;
}
