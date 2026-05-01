import * as React from 'react';
import { Text } from '@react-email/components';
import { EmailLayout } from '../components/EmailLayout';
import { HeroImage } from '../components/HeroImage';
import { InvestmentPanel } from '../components/InvestmentPanel';
import { NextSteps } from '../components/NextSteps';
import { Summary } from '../components/Summary';
import { THEME } from '../theme';
import { formatNZD } from '../utils/money';
import type { ResidentialOrCommercial } from '../types';

export function CustomerCommercialEmail(props: ResidentialOrCommercial & { callWindowText: string }) {
  const baseRange = `${formatNZD(props.baseRange.lowIncGst)} - ${formatNZD(
    props.baseRange.highIncGst,
  )}`;
  const blindsRange =
    props.blindsSelected && props.blindsRange
      ? `${formatNZD(props.blindsRange.lowIncGst)} - ${formatNZD(props.blindsRange.highIncGst)}`
      : undefined;

  const addonsText = props.addons?.length ? props.addons.join(', ') : '-';

  return (
    <EmailLayout preview="Your indicative commercial range and next steps from Sanctuary Pergolas.">
      <HeroImage />

      <Text style={{ margin: '0 0 10px', fontSize: 22, lineHeight: 1.25, fontWeight: 700 }}>
        Thanks {props.name}, we&apos;ve received your commercial pergola enquiry.
      </Text>

      <Text style={{ margin: '0 0 12px', fontSize: 14, color: THEME.muted, lineHeight: 1.6 }}>
        One of our team will review your enquiry and be in touch shortly to talk through the best options
        for your space.
      </Text>

      <InvestmentPanel
        baseRange={baseRange}
        blindsRange={blindsRange}
        note="The lower figure reflects a base structure under standard assumptions (normal access, standard fixings/colour, fascia connection). Final pricing is confirmed after a quick check of site conditions and connection details."
      />

      <NextSteps />

      <Summary
        title="Your request"
        rows={[
          { label: 'Area', value: props.suburb },
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
        To keep things moving
      </Text>
      <Text style={{ margin: '0 0 4px', fontSize: 13, lineHeight: 1.6 }}>
        1) Reply with the site address (or nearest cross-street)
      </Text>
      <Text style={{ margin: '0 0 4px', fontSize: 13, lineHeight: 1.6 }}>
        2) Any restricted work hours / access constraints
      </Text>
      <Text style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
        3) Deadline or preferred install window
      </Text>

      <Text style={{ margin: '14px 0 0', fontSize: 12, color: THEME.muted, lineHeight: 1.6 }}>
        Note: Add-ons such as lighting/heating/slats are not included in the estimate at this stage. Blinds are included only if selected above.
      </Text>
    </EmailLayout>
  );
}
