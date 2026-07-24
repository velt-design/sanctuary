import * as React from 'react';
import { Text } from '@react-email/components';
import { THEME } from '../theme';

export function AttachmentLinks({
  files,
}: {
  files?: Array<{ name: string; url: string }>;
}) {
  if (!files?.length) return null;

  return (
    <>
      <Text style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600 }}>
        Your files
      </Text>
      <Text style={{ margin: '0 0 14px', fontSize: 13, color: THEME.muted, lineHeight: 1.6 }}>
        {files.map((file, index) => (
          <React.Fragment key={`${file.name}-${index}`}>
            <a href={file.url} style={{ color: THEME.text }}>
              {file.name}
            </a>
            {index < files.length - 1 ? <br /> : null}
          </React.Fragment>
        ))}
      </Text>
    </>
  );
}
