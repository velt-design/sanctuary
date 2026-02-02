import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { Summary } from '../components/Summary';
import { THEME } from '../theme';
import type { Professional } from '../types';

export function CustomerProfessionalEmail(props: Professional & { callWindowText: string }) {
  return (
    <EmailLayout preview="Professional enquiry received - we'll call shortly.">
      <Text style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 600 }}>
        Professional enquiry received
      </Text>

      <Text style={{ margin: '0 0 12px', fontSize: 13, color: THEME.muted, lineHeight: 1.6 }}>
        Hi {props.name}, thanks for your enquiry. We'll call you on{' '}
        <span style={{ color: THEME.text, fontWeight: 600 }}>{props.phone}</span> {props.callWindowText}.
      </Text>

      <Summary
        title="Summary"
        rows={[
          { label: 'Company', value: props.company?.trim() ? props.company.trim() : '-' },
          { label: 'Area', value: props.suburb },
          { label: 'Files received', value: String(props.filesReceivedCount ?? 0) },
          { label: 'Notes', value: props.message?.trim() ? props.message.trim() : '-' },
        ]}
      />

      <Text style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>
        Next step
      </Text>
      <Text style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
        If you can share approximate dimensions or drawings (plan/elevation), we can usually provide a
        preliminary budget range quickly, then confirm after a measured check and detailing review.
      </Text>

      <Text style={{ margin: '14px 0 0', fontSize: 12, color: THEME.muted, lineHeight: 1.6 }}>
        Helpful to include: project stage (concept / developed design / consent / construction), and any key
        constraints (boundary proximity, wind exposure, interface details).
      </Text>
    </EmailLayout>
  );
}
