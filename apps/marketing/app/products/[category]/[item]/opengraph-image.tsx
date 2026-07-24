import { ImageResponse } from 'next/og';
import { getProduct } from '@/data/products';
import { absoluteUrl } from '@/lib/seo';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ category: string; item: string }>;
}) {
  const { category, item } = await params;
  const product = getProduct(category, item);
  const title = product?.name ?? 'Sanctuary Pergolas';
  const proposition = product?.proposition ?? 'Custom-designed outdoor rooms';
  const label = product?.categoryLabel ?? 'Products';
  const bg = absoluteUrl(product?.metadata.ogImage ?? '/assets/hero-right.jpg');
  const logo = absoluteUrl('/logo-sanctuary.svg');

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          position: 'relative',
          background: '#0b0b0b',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <img
          src={bg}
          alt=""
          width={1200}
          height={630}
          style={{ position: 'absolute', inset: 0, objectFit: 'cover', opacity: 0.9 }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, rgba(13,15,12,0.78), rgba(13,15,12,0.18))',
          }}
        />
        <div style={{ position: 'absolute', left: 48, top: 40, display: 'flex', alignItems: 'center', gap: 16, zIndex: 2 }}>
          <div style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.94)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={logo} width={56} height={56} alt="Sanctuary logo" style={{ objectFit: 'contain' }} />
          </div>
          <div style={{ fontSize: 22, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
        </div>
        <div style={{ position: 'absolute', left: 48, bottom: 58, right: 48, display: 'flex', flexDirection: 'column', gap: 14, zIndex: 2 }}>
          <div style={{ maxWidth: 830, fontSize: 72, fontWeight: 600, lineHeight: 1.02 }}>{title}</div>
          <div style={{ maxWidth: 760, fontSize: 24, lineHeight: 1.35, opacity: 0.88 }}>{proposition}</div>
          <div style={{ fontSize: 24, opacity: 0.95 }}>sanctuarypergolas.co.nz</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
