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
      <div className={styles.editorialCardContent}>
        {indexLabel ? <span className={styles.editorialCardNumber}>{indexLabel}</span> : null}
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <Heading as={headingLevel} variant="card">{title}</Heading>
        {copy ? <Text size={variant === 'compact' ? 'small' : 'body'}>{copy}</Text> : null}
        <span className={styles.editorialCardAction}>{actionLabel}</span>
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
