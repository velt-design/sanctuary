import type { CSSProperties } from 'react';
import SidebarRevealOverlayLab from '@/components/navigation/SidebarRevealOverlayLab';

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  color: 'rgba(var(--portal-text-rgb), 0.92)',
};

const copyStyle: CSSProperties = {
  margin: 0,
  maxWidth: '78ch',
  fontSize: '14px',
  lineHeight: 1.55,
  color: 'rgba(var(--portal-text-rgb), 0.68)',
};

export default function SidebarLabPage() {
  return (
    <>
      <SidebarRevealOverlayLab />
      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '28px',
          padding: '28px 24px 48px',
          background: 'rgba(var(--portal-bg-rgb), 0.98)',
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <p
          style={{
            margin: 0,
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(var(--portal-text-rgb), 0.48)',
          }}
        >
          Sidebar Lab
        </p>
        <h1 style={{ margin: 0, fontSize: '32px', lineHeight: 1.05 }}>Hover interaction review</h1>
        <p style={copyStyle}>
          This route now uses the real fixed portal sidebar on the left as the experiment surface. There is no embedded mock
          sidebar anymore, so the icon lane stays native and only the hover-reveal behavior is under review.
        </p>
        </header>

        <section style={sectionStyle}>
          <h2 style={titleStyle}>How To Review It</h2>
          <p style={copyStyle}>
            Hover the real left sidebar area to reveal labels. The lab uses a 90ms open delay, a 150ms close delay, and
            expands immediately on keyboard focus. Press <kbd>Escape</kbd> while the overlay is focused if you want to collapse
            it after inspection.
          </p>
          <p style={copyStyle}>
            What to watch for: the first 56px should still look like the normal live sidebar, labels should feel like they are
            being revealed rather than the sidebar being redesigned, and moving into the text column should feel forgiving.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={titleStyle}>Review Notes</h2>
          <p style={copyStyle}>
            This route is lab-only. The overlay is intentionally text-only and non-interactive so we can judge placement,
            proportion, and hover stability without navigation behavior or submenu logic getting in the way.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            {[
              'Does the icon strip still feel identical to the live product?',
              'Does the label column feel calm and proportional?',
              'Does moving from icon lane into labels feel forgiving rather than jumpy?',
            ].map((note) => (
              <div
                key={note}
                style={{
                  border: '1px solid rgba(var(--portal-text-rgb), 0.08)',
                  borderRadius: '18px',
                  padding: '18px 18px 16px',
                  background: 'rgba(var(--portal-bg-surface-rgb), 0.9)',
                  color: 'rgba(var(--portal-text-rgb), 0.8)',
                  fontSize: '14px',
                  lineHeight: 1.5,
                }}
              >
                {note}
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
