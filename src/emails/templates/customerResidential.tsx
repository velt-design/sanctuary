import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { EstimateCard } from '../components/EstimateCard';
import { Summary } from '../components/Summary';
import { THEME } from '../theme';
import { formatNZD } from '../utils/money';
import type { ResidentialOrCommercial } from '../types';

export function CustomerResidentialEmail(props: ResidentialOrCommercial & { callWindowText: string }) {
  const baseLine = `Base pergola structure: ${formatNZD(props.baseRange.lowIncGst)} - ${formatNZD(
    props.baseRange.highIncGst,
  )} (incl. GST)`;
  const lines = [baseLine];

  if (props.blindsSelected && props.blindsRange) {
    lines.push(
      `Blinds (separate): ${formatNZD(props.blindsRange.lowIncGst)} - ${formatNZD(
        props.blindsRange.highIncGst,
      )} (incl. GST)`,
    );
  }

  const addonsText = props.addons?.length ? props.addons.join(', ') : '-';

  return (
    <EmailLayout preview="Enquiry received - we'll call shortly.">
      <Text style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 600 }}>
        Enquiry received
      </Text>

      <Text style={{ margin: '0 0 12px', fontSize: 13, color: THEME.muted, lineHeight: 1.6 }}>
        Hi {props.name}, thanks for your enquiry. We'll call you on{' '}
        <span style={{ color: THEME.text, fontWeight: 600 }}>{props.phone}</span> {props.callWindowText}.
      </Text>

      <EstimateCard
        title="Estimated investment range (installed)"
        lines={lines}
        note="Generated from your size and selections using standard assumptions (normal access, standard fixings/colour, fascia connection). Final pricing is confirmed after a quick check of site conditions and connection details."
      />

      <Summary
        title="Your request"
        rows={[
          { label: 'Suburb', value: props.suburb },
          {
            label: 'Size',
            value: `${props.widthM}m (W) x ${props.depthM}m (D) x ${props.heightM}m (H)`,
          },
          { label: 'Style', value: String(props.style) },
          { label: 'Roof', value: String(props.roof) },
          { label: 'Add-ons selected', value: addonsText },
          { label: 'Notes', value: props.message?.trim() ? props.message.trim() : '-' },
        ]}
      />

      <Text style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>
        To firm this up quickly
      </Text>
      <Text style={{ margin: '0 0 4px', fontSize: 13, lineHeight: 1.6 }}>
        1) Reply with 2-3 photos (house junction + ground surface)
      </Text>
      <Text style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
        2) Your ideal timing (next month / 1-3 months / 3-6 months / planning)
      </Text>

      <Text style={{ margin: '14px 0 0', fontSize: 12, color: THEME.muted, lineHeight: 1.6 }}>
        Note: Add-ons such as lighting/heating/slats are not included in the estimate at this stage. Blinds are included only if selected above.
      </Text>
    </EmailLayout>
  );
}
