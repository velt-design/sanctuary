import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { Summary } from '../components/Summary';
import { THEME } from '../theme';
import { formatNZD } from '../utils/money';
import type { ResidentialOrCommercial } from '../types';

export function InternalCommercialEmail(props: ResidentialOrCommercial & { callWindowText: string }) {
  const base = `${formatNZD(props.baseRange.lowIncGst)} - ${formatNZD(props.baseRange.highIncGst)} (base)`;
  const blinds =
    props.blindsSelected && props.blindsRange
      ? `${formatNZD(props.blindsRange.lowIncGst)} - ${formatNZD(props.blindsRange.highIncGst)} (blinds)`
      : '-';

  return (
    <EmailLayout preview={`New commercial lead - ${props.name} (${props.suburb})`}>
      <Text style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600 }}>
        New Commercial Lead
      </Text>

      <Text style={{ margin: '0 0 12px', fontSize: 13, color: THEME.muted, lineHeight: 1.6 }}>
        Call {props.phone} {props.callWindowText}. Lead ID:{' '}
        <span style={{ color: THEME.text, fontWeight: 600 }}>{props.leadId}</span>
      </Text>

      <Summary
        title="Lead details"
        rows={[
          { label: 'Name', value: props.name },
          { label: 'Phone', value: props.phone },
          { label: 'Email', value: props.email },
          { label: 'Area', value: props.suburb },
          { label: 'Size', value: `${props.widthM}x${props.depthM}x${props.heightM}m` },
          { label: 'Style', value: String(props.style) },
          { label: 'Roof', value: String(props.roof) },
          { label: 'Add-ons', value: props.addons?.length ? props.addons.join(', ') : '-' },
          { label: 'Estimate', value: `Base: ${base} | Blinds: ${blinds}` },
          { label: 'UTM', value: `${props.utmSource ?? '-'} / ${props.utmMedium ?? '-'} / ${props.utmCampaign ?? '-'}` },
          { label: 'Landing URL', value: props.landingUrl ?? '-' },
          { label: 'Notes', value: props.message?.trim() ? props.message.trim() : '-' },
        ]}
      />

      <Text style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600 }}>
        Admin checklist
      </Text>
      <Text style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
        - Call within 30 minutes (business hours)
        <br />
        - Confirm access constraints + preferred install window
        <br />
        - Ask for site address and any restricted work hours
      </Text>
    </EmailLayout>
  );
}
