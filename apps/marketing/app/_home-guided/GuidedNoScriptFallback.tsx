import Link from 'next/link';
import styles from './guidedHomepage.module.css';

const fallbackPaths = [
  {
    href: '/pergolas-auckland',
    label: 'Residential pergolas',
    description: 'Plan a refined fixed roof for a deck, patio or pool area.',
  },
  {
    href: '/outdoor-rooms-auckland',
    label: 'Outdoor rooms',
    description: 'Explore integrated spaces for daily living and entertaining.',
  },
  {
    href: '/custom-pergolas-auckland',
    label: 'Bespoke pergolas',
    description: 'Start with a difficult connection, structure or site condition.',
  },
  {
    href: '/commercial-pergolas-auckland',
    label: 'Commercial pergolas',
    description: 'Plan shelter for hospitality, workplaces and specialist sites.',
  },
  {
    href: '/architects-designers-builders',
    label: 'Architects, designers and builders',
    description: 'Coordinate design input, scope and delivery with Sanctuary.',
  },
] as const;

export default function GuidedNoScriptFallback() {
  return (
    <noscript>
      <style>{`.${styles.interactive}{display:none!important}`}</style>
      <section
        className={styles.noScript}
        aria-labelledby="guided-no-script-heading"
      >
        <p className={styles.eyebrow}>Project pathways</p>
        <h2 id="guided-no-script-heading">Choose a useful starting point.</h2>
        <p>
          The guided conversation needs JavaScript. These five pathways remain
          available directly.
        </p>
        <ul>
          {fallbackPaths.map((path) => (
            <li key={path.href}>
              <Link href={path.href}>{path.label}</Link>
              <span>{path.description}</span>
            </li>
          ))}
        </ul>
      </section>
    </noscript>
  );
}
