import Link from 'next/link';
import styles from './projectFinderHomepage.module.css';

const fallbackPaths = [
  { href: '/pergolas-auckland', label: 'A refined deck cover' },
  { href: '/outdoor-rooms-auckland', label: 'A complete outdoor room' },
  { href: '/custom-pergolas-auckland', label: 'A bespoke or difficult-site solution' },
] as const;

export default function ProjectFinderNoScriptFallback({
  enquiryHref,
}: {
  enquiryHref: string;
}) {
  return (
    <noscript>
      <style>{`[data-project-finder-interactive]{display:none!important}`}</style>
      <section
        className={styles.noScript}
        aria-labelledby="project-finder-no-script-heading"
      >
        <p className={styles.eyebrow}>Find your starting point</p>
        <h2 id="project-finder-no-script-heading">
          Three direct project pathways.
        </h2>
        <p>
          The visual finder needs JavaScript. You can still explore each
          project direction or start an enquiry directly.
        </p>
        <ul>
          {fallbackPaths.map((path) => (
            <li key={path.href}>
              <Link href={path.href}>{path.label}</Link>
            </li>
          ))}
        </ul>
        <nav className={styles.noScriptAudience} aria-label="Other project pathways">
          <span>Other project pathways</span>
          <Link href="/commercial-pergolas-auckland">Commercial clients</Link>
          <Link href="/architects-designers-builders">
            Architects, designers and builders
          </Link>
        </nav>
        <Link className={styles.noScriptAction} href={enquiryHref}>
          Start your project
        </Link>
      </section>
    </noscript>
  );
}
