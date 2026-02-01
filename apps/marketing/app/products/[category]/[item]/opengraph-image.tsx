import { ImageResponse } from 'next/og';
import { sections } from '@/data/mega';
import { stripArrow, absoluteUrl, imageForSlug } from '@/lib/seo';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function norm(s: string) {
  return s.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-');
}

export default async function Image({ params }: { params: { category: string; item: string } }) {
  const { category, item } = params;
  const sec = sections.find((s) => norm(s.heading) === category);
  const entry = sec?.items.find((i) => (i.href.split('/').pop() || '') === item);

  const title = stripArrow(entry?.title || item);
  const label = sec?.heading === 'Screens & walls' ? 'Slats & Screens' : sec?.heading || 'Products';
  const bg = absoluteUrl(imageForSlug(item));
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
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
        }}
      >
        {/* Background image */}
        <img
          src={bg}
          alt=""
          width={1200}
          height={630}
          style={{ position: 'absolute', inset: 0, objectFit: 'cover', opacity: 0.9 }}
        />
        {/* Gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, rgba(0,0,0,0.7), rgba(0,0,0,0.25))',
          }}
        />
        {/* Brand strip + text */}
        <div style={{ position: 'absolute', left: 48, top: 40, display: 'flex', alignItems: 'center', gap: 16, zIndex: 2 }}>
          <div style={{ width: 72, height: 72, background: 'rgba(255,255,255,0.92)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={logo} width={56} height={56} alt="Sanctuary logo" style={{ objectFit: 'contain' }} />
          </div>
          <div style={{ fontSize: 28, background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: 8 }}>{label}</div>
        </div>
        <div style={{ position: 'absolute', left: 48, bottom: 72, right: 48, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 2 }}>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.06, textShadow: '0 4px 20px rgba(0,0,0,0.45)' }}>{title}</div>
          <div style={{ fontSize: 24, opacity: 0.95 }}>sanctuarypergolas.co.nz</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
