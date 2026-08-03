import Link from 'next/link';
import styles from './projectFinderHomepage.module.css';

const fallbackPaths = [
  { href: '/acrylic-roof-pergolas-auckland', label: 'Simple cover' },
  { href: '/custom-pergolas-auckland', label: 'Custom design' },
] as const;

const professionalFallbackPaths = [
  { href: '/commercial-pergolas-auckland', label: 'Extending a Venue' },
  { href: '/architects-designers-builders', label: 'Builder or Contractor' },
  { href: '/architects-designers-builders', label: 'Architects and Designers' },
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
          Choose the path that best fits your project.
        </h2>
        <p>
          The visual finder needs JavaScript. You can still explore each
          project pathway or start an enquiry directly.
        </p>
        <ul>
          {fallbackPaths.map((path) => (
            <li key={path.href}>
              <Link href={path.href}>{path.label}</Link>
            </li>
          ))}
        </ul>
        <nav
          className={styles.noScriptAudience}
          aria-label="Commercial and professional pathways"
        >
          <span>Commercial / Professional</span>
          {professionalFallbackPaths.map((path) => (
            <Link href={path.href} key={path.label}>{path.label}</Link>
          ))}
        </nav>
        <Link className={styles.noScriptAction} href={enquiryHref}>
          Start your project
        </Link>
      </section>
    </noscript>
  );
}
