/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from 'next/og';
import { absoluteUrl } from '@/lib/seo';

export const runtime = 'edge';

export async function GET() {
  const logo = absoluteUrl('/logo-sanctuary.svg');
  return new ImageResponse(
    (
      <div
        style={{
          width: '512px',
          height: '512px',
          display: 'flex',
          background: '#ffffff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img src={logo} width={360} height={360} alt="Sanctuary" style={{ objectFit: 'contain' }} />
      </div>
    ),
    { width: 512, height: 512 }
  );
}
