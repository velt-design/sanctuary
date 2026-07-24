import * as React from 'react';
import { Text } from '@react-email/components';
import { THEME } from '../theme';

type AttachmentLinksProps = {
  links?: Array<{ name: string; url: string }>;
};

export function AttachmentLinks({ links }: AttachmentLinksProps) {
  if (!links?.length) return null;

  return (
    <>
      <Text style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600 }}>
        Your files
      </Text>
      <Text style={{ margin: '0 0 14px', fontSize: 13, color: THEME.muted, lineHeight: 1.6 }}>
        {links.map((file, index) => (
          <React.Fragment key={`${file.name}-${index}`}>
            <a href={file.url} style={{ color: THEME.text }}>
              {file.name}
            </a>
            {index < links.length - 1 ? <br /> : null}
          </React.Fragment>
        ))}
      </Text>
    </>
  );
}

