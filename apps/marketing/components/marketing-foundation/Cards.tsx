import Link, { type LinkProps } from 'next/link';
import type { ComponentPropsWithoutRef, CSSProperties, HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import { Eyebrow, Figure, Heading, Text, type MediaRatio } from './Primitives';
import styles from './foundation.module.css';

type EditorialCardVariant = 'image-led' | 'balanced' | 'compact';

type EditorialCardMedia = {
  image: string;
  alt: string;
  ratio?: MediaRatio;
  mobileRatio?: MediaRatio;
  priority?: boolean;
  sizes?: string;
  objectPosition?: string;
  mobileObjectPosition?: string;
};

type EditorialCardProps = Omit<ComponentPropsWithoutRef<typeof Link>, 'children' | 'href' | 'media' | 'title'> & {
  href: LinkProps['href'];
  variant?: EditorialCardVariant;
  eyebrow?: string;
  title: string;
  copy?: string;
  condensedMeta?: string;
  actionLabel: string;
  indexLabel?: string;
  media?: EditorialCardMedia;
  headingLevel?: 'h2' | 'h3';
};

export function EditorialCard({
  variant = 'balanced',
  eyebrow,
  title,
  copy,
  condensedMeta,
  actionLabel,
  indexLabel,
  media,
  headingLevel = 'h3',
  className,
  ...props
}: EditorialCardProps) {
  return (
    <Link
      {...props}
      className={cn(
        styles.editorialCard,
        variant === 'image-led' && styles.editorialCardImageLed,
        variant === 'balanced' && styles.editorialCardBalanced,
        variant === 'compact' && styles.editorialCardCompact,
        className,
      )}
      data-editorial-card={variant}
    >
      {media ? (
        <Figure
          {...media}
          className={styles.editorialCardMedia}
        />
      ) : null}
      <div className={styles.editorialCardContent} data-editorial-card-content>
        {indexLabel ? <span className={styles.editorialCardNumber}>{indexLabel}</span> : null}
        {eyebrow ? <Eyebrow data-editorial-card-eyebrow>{eyebrow}</Eyebrow> : null}
        <Heading as={headingLevel} variant="card" data-editorial-card-title>{title}</Heading>
        {copy ? (
          <Text data-editorial-card-copy size={variant === 'compact' ? 'small' : 'body'}>
            {copy}
          </Text>
        ) : null}
        {condensedMeta ? (
          <span
            className={styles.editorialCardCondensedMeta}
            data-editorial-card-condensed-meta
          >
            {condensedMeta}
          </span>
        ) : null}
        <span className={styles.editorialCardAction} data-editorial-card-action>
          {actionLabel}
        </span>
      </div>
    </Link>
  );
}

export function CardGrid({
  columns = 3,
  className,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  columns?: 1 | 2 | 3;
}) {
  const gridStyle = {
    ...style,
    '--card-grid-columns': columns,
  } as CSSProperties;

  return (
    <div
      {...props}
      className={cn(styles.cardGrid, className)}
      data-card-grid={columns}
      style={gridStyle}
    />
  );
}
