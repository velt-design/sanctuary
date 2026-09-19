import * as React from 'react';
import { Button, Section, Text } from '@react-email/components';
import type { CustomerBrief } from '../lib/enquiryDesignContract';
import { customerDesignUrl } from '../lib/enquiryDesignLink';
import { THEME } from './theme';

export function submittedEmailDesign(variables: Record<string, unknown>) {
  const brief = variables.customerBrief as CustomerBrief | undefined;
  const designUrl = brief?.design ? (typeof variables.submittedDesignUrl === 'string' && /^https:\/\/(www\.sanctuarypergolas\.co\.nz|[a-z0-9.-]+\.vercel\.app)\/configurator-preview\?open=1#design=/.test(variables.submittedDesignUrl) ? variables.submittedDesignUrl : customerDesignUrl(brief)) : undefined;
  return designUrl ? { url: designUrl, summary: brief?.summary } : undefined;
}

export function SubmittedDesign({ design }: { design: ReturnType<typeof submittedEmailDesign> }) {
  if (!design) return null;
  return <Section style={{ margin: '24px 0' }}>
    <Button className="spx-button" href={design.url} style={{ backgroundColor: THEME.inverse, color: THEME.inverseText, padding: '15px 20px', fontSize: 16, lineHeight: 1.4 }}>View your submitted pergola</Button>
    <Text className="spx-muted" style={{ margin: '10px 0 0', color: THEME.muted, fontSize: 14, lineHeight: 1.6 }}>Later changes won’t update this enquiry. Reply to request a revision.</Text>
  </Section>;
}

export function ReceiptClosing({ filesReceivedCount, hasDownloadLinks }: { filesReceivedCount?: number; hasDownloadLinks: boolean }) {
  return <>
    {!hasDownloadLinks && Number(filesReceivedCount) > 0 && <Text className="spx-muted" style={{ color: THEME.muted, fontSize: 14, lineHeight: 1.6, margin: '20px 0' }}>{filesReceivedCount} {filesReceivedCount === 1 ? 'file' : 'files'} received with your enquiry.</Text>}
    <Text className="spx-text" style={{ margin: '24px 0 0', color: THEME.text, fontSize: 16, lineHeight: 1.65 }}>Questions or something to add? Reply to this email.</Text>
  </>;
}
