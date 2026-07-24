import * as React from 'react';
import { Text } from '@react-email/components';
import { AttachmentLinks } from '../components/AttachmentLinks';
import { EmailLayout } from '../components/EmailLayout';
import { HeroImage } from '../components/HeroImage';
import { InvestmentPanel, formatInvestmentAmount } from '../components/InvestmentPanel';
import { NextSteps } from '../components/NextSteps';
import { Summary } from '../components/Summary';
import { THEME } from '../theme';
import { formatNZD } from '../utils/money';
import type { ResidentialOrCommercial } from '../types';

export function CustomerCommercialEmail(props: ResidentialOrCommercial & { callWindowText: string }) {
  const baseIsSingleAmount = props.baseRange.lowIncGst === props.baseRange.highIncGst;
  const baseRange = formatInvestmentAmount(props.baseRange, formatNZD);
  const blindsRange =
    props.blindsSelected && props.blindsRange
      ? formatInvestmentAmount(props.blindsRange, formatNZD)
      : undefined;

  const addonsText = props.addons?.length ? props.addons.join(', ') : '-';

  return (
    <EmailLayout
      preview={
        baseIsSingleAmount
          ? 'Your indicative commercial estimate and next steps from Sanctuary Pergolas.'
          : 'Your indicative commercial range and next steps from Sanctuary Pergolas.'
      }
    >
      <HeroImage />

      <Text style={{ margin: '0 0 12px', fontSize: 24, lineHeight: 1.22, fontWeight: 700 }}>
        Your commercial pergola enquiry has been received
      </Text>

      <Text style={{ margin: '0 0 10px', fontSize: 14, color: THEME.text, lineHeight: 1.65 }}>
        Thanks {props.name}. Based on the details you shared, we&apos;ve prepared an initial installed
        {baseIsSingleAmount ? ' estimate' : ' investment range'} for your project.
      </Text>
      <Text style={{ margin: '0 0 4px', fontSize: 13, color: THEME.muted, lineHeight: 1.65 }}>
        One of our team will review your enquiry and be in touch shortly to talk through the best approach
        for your space.
      </Text>

      <InvestmentPanel
        baseRange={baseRange}
        blindsRange={blindsRange}
        note={
          baseIsSingleAmount
            ? 'The amount shown reflects a base structure under standard assumptions (normal access, standard fixings/colour, fascia connection). Final pricing is confirmed after a quick check of site conditions and connection details.'
            : 'The lower figure reflects a base structure under standard assumptions (normal access, standard fixings/colour, fascia connection). Final pricing is confirmed after a quick check of site conditions and connection details.'
        }
      />

      <NextSteps />

      <Summary
        title="Project details received"
        rows={[
          { label: 'Area', value: props.suburb },
          {
            label: 'Size',
            value: `${props.widthM}m (W) x ${props.depthM}m (D) x ${props.heightM}m (H)`,
          },
          { label: 'Style', value: String(props.style) },
          { label: 'Roof', value: String(props.roof) },
          { label: 'Add-ons selected', value: addonsText },
          { label: 'Files received', value: String(props.filesReceivedCount ?? 0) },
          { label: 'Notes', value: props.message?.trim() ? props.message.trim() : '-' },
        ]}
      />

      <AttachmentLinks files={props.attachmentLinks} />

      <Text style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>
        Helpful next details
      </Text>
      <Text style={{ margin: 0, fontSize: 13, color: THEME.muted, lineHeight: 1.65 }}>
        If you have more photos, plans, or a preferred timeframe, simply reply to this email and send them through.
      </Text>

      <Text style={{ margin: '14px 0 0', fontSize: 12, color: THEME.muted, lineHeight: 1.6 }}>
        Note: Add-ons such as lighting/heating/slats are not included in the estimate at this stage. Blinds are included only if selected above.
      </Text>
    </EmailLayout>
  );
}
