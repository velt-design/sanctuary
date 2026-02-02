import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { Summary } from '../components/Summary';
import { THEME } from '../theme';
import type { Professional } from '../types';

export function InternalProfessionalEmail(props: Professional & { callWindowText: string }) {
  return (
    <EmailLayout preview={`New professional lead - ${props.name} (${props.suburb})`}>
      <Text style={{ margin: '0 0 10px', fontSize: 16, fontWeight: 600 }}>
        New Professional Lead
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
          { label: 'Company', value: props.company?.trim() ? props.company.trim() : '-' },
          { label: 'Area', value: props.suburb },
          { label: 'Files received', value: String(props.filesReceivedCount ?? 0) },
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
        - Request drawings/dimensions and project stage
        <br />
        - Confirm any key constraints (boundary, wind exposure, interfaces)
      </Text>
    </EmailLayout>
  );
}
