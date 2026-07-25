import * as React from 'react';
import { Img, Link, Section, Text } from '@react-email/components';
import type { WebsiteAutoresponderHero } from '../../lib/websiteAutoresponderHero';
import { THEME } from '../theme';

export function HeroImage({ hero }: { hero: WebsiteAutoresponderHero }) {
  return (
    <Section style={{ margin: '0 0 28px' }}>
      <Link href={hero.projectHref} style={{ display: 'block', textDecoration: 'none' }}>
        <Img
          src={hero.imageUrl}
          alt={hero.imageAlt}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: '100%',
            height: 'auto',
            border: '0',
          }}
        />
      </Link>
      <Section
        style={{
          padding: '11px 0 0',
          borderTop: `1px solid ${THEME.ruleStrong}`,
        }}
      >
        <Text
          style={{
            margin: '0 0 3px',
            color: THEME.subtle,
            fontFamily: THEME.font,
            fontSize: 9,
            lineHeight: 1.4,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Completed Sanctuary project
        </Text>
        <Link
          href={hero.projectHref}
          style={{
            color: THEME.text,
            fontFamily: THEME.font,
            fontSize: 12,
            fontWeight: 700,
            lineHeight: 1.45,
            textDecoration: 'none',
          }}
        >
          {hero.projectTitle} · {hero.location}
        </Link>
        <Text
          style={{
            margin: '3px 0 0',
            color: THEME.subtle,
            fontFamily: THEME.font,
            fontSize: 10,
            lineHeight: 1.5,
          }}
        >
          {hero.roofApproach}
        </Text>
      </Section>
    </Section>
  );
}
