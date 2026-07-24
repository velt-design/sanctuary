import * as React from 'react';
import { Link, Section, Text } from '@react-email/components';
import { THEME } from '../theme';

type AttachmentLinksProps = {
  links?: Array<{ name: string; url: string }>;
};

export function AttachmentLinks({ links }: AttachmentLinksProps) {
  if (!links?.length) return null;

  return (
    <Section
      style={{
        margin: '0 0 28px',
        padding: '18px',
        backgroundColor: THEME.warm,
        borderTop: `1px solid ${THEME.ruleStrong}`,
        borderBottom: `1px solid ${THEME.rule}`,
      }}
    >
      <Text style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>
        Files received with your enquiry
      </Text>
      <Text style={{ margin: '0 0 9px', fontSize: 12, color: THEME.muted, lineHeight: 1.65 }}>
        {links.map((file, index) => (
          <React.Fragment key={`${file.name}-${index}`}>
            <Link href={file.url} style={{ color: THEME.text, textDecoration: 'underline' }}>
              {file.name}
            </Link>
            {index < links.length - 1 ? <br /> : null}
          </React.Fragment>
        ))}
      </Text>
      <Text style={{ margin: 0, fontSize: 10, color: THEME.subtle, lineHeight: 1.55 }}>
        Secure download links expire seven days after the enquiry was submitted.
      </Text>
    </Section>
  );
}
