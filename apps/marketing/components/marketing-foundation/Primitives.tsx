import Image, { type ImageProps } from 'next/image';
import Link from 'next/link';
import type {
  ComponentPropsWithoutRef,
  CSSProperties,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/cn';
import styles from './foundation.module.css';

export type ContainerWidth = 'wide' | 'standard' | 'compact' | 'reading';
export type MediaRatio = 'wide' | 'landscape' | 'standard' | 'portrait' | 'square';

export function MarketingPage({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <main
      {...props}
      className={cn(styles.marketingPage, className)}
      data-marketing-foundation-page
    />
  );
}

export function Container({ width = 'standard', className, ...props }: HTMLAttributes<HTMLDivElement> & { width?: ContainerWidth }) {
  return <div className={cn(styles.container, width === 'wide' && styles.containerWide, width === 'compact' && styles.containerCompact, width === 'reading' && styles.containerReading, className)} {...props} />;
}

export function Section({ tone = 'canvas', compact, className, ...props }: HTMLAttributes<HTMLElement> & { tone?: 'canvas' | 'warm' | 'neutral' | 'elevated' | 'inverse'; compact?: boolean }) {
  return <section className={cn(styles.section, compact && styles.sectionCompact, styles[tone], className)} {...props} />;
}

export function Eyebrow(props: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={cn(styles.eyebrow, props.className)} />;
}

export function Heading({ as: Tag = 'h2', variant = 'section', className, ...props }: HTMLAttributes<HTMLHeadingElement> & { as?: 'h1' | 'h2' | 'h3'; variant?: 'display' | 'page' | 'section' | 'card' }) {
  return <Tag className={cn(styles.heading, variant === 'section' ? styles.sectionHeading : styles[variant], className)} {...props} />;
}

export function Text({ size = 'body', className, ...props }: HTMLAttributes<HTMLParagraphElement> & { size?: 'body' | 'large' | 'small' }) {
  return <p className={cn(styles.text, size === 'large' && styles.textLarge, size === 'small' && styles.textSmall, className)} {...props} />;
}

type ActionProps = ComponentPropsWithoutRef<typeof Link> & { variant?: 'primary' | 'secondary' | 'outline' };
export function Button({ variant = 'primary', className, ...props }: ActionProps) {
  const semanticVariant = variant === 'outline' ? 'secondary' : variant;
  const variantClass = semanticVariant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary;
  return (
    <Link
      {...props}
      className={cn(styles.button, variantClass, className)}
      data-action-variant={semanticVariant}
    />
  );
}

export function TextLink({ className, ...props }: ComponentPropsWithoutRef<typeof Link>) {
  return <Link {...props} className={cn(styles.textLink, className)} data-action-variant="text" />;
}

export function Rule({ className }: { className?: string }) { return <hr className={cn(styles.rule, className)} />; }

const ratioClasses: Record<MediaRatio, string | undefined> = {
  wide: styles.figureWide,
  landscape: styles.figureLandscape,
  standard: undefined,
  portrait: styles.figurePortrait,
  square: styles.figureSquare,
};

const mobileRatioClasses: Record<MediaRatio, string> = {
  wide: styles.figureMobileWide,
  landscape: styles.figureMobileLandscape,
  standard: styles.figureMobileStandard,
  portrait: styles.figureMobilePortrait,
  square: styles.figureMobileSquare,
};

export function Figure({
  image,
  alt,
  caption,
  detail,
  ratio = 'landscape',
  mobileRatio,
  priority = false,
  sizes,
  className,
  objectPosition,
  mobileObjectPosition,
}: {
  image: string;
  alt: string;
  caption?: string;
  detail?: string;
  ratio?: MediaRatio;
  mobileRatio?: MediaRatio;
  priority?: boolean;
  sizes?: string;
  className?: string;
  objectPosition?: string;
  mobileObjectPosition?: string;
}) {
  const imageProps: Pick<ImageProps, 'quality' | 'sizes'> = { quality: 75, sizes: sizes ?? '(max-width: 700px) 100vw, 66vw' };
  const mediaStyle = {
    '--figure-object-position': objectPosition,
    '--figure-mobile-object-position': mobileObjectPosition ?? objectPosition,
  } as CSSProperties;

  return (
    <figure
      className={cn(styles.figure, className)}
      data-responsive-media
      data-mobile-ratio={mobileRatio}
    >
      <div
        className={cn(
          styles.figureMedia,
          ratioClasses[ratio],
          mobileRatio && mobileRatioClasses[mobileRatio],
        )}
        style={mediaStyle}
      >
        <Image src={image} alt={alt} fill priority={priority} {...imageProps} />
      </div>
      {(caption || detail) && <figcaption className={styles.caption}><span>{caption}</span><span>{detail}</span></figcaption>}
    </figure>
  );
}

export function ProjectMeta({ items, className }: { items: string[]; className?: string }) {
  return <ul className={cn(styles.projectMeta, className)}>{items.filter(Boolean).map((item) => <li key={item}>{item}</li>)}</ul>;
}

export function ActionGroup({
  className,
  role = 'group',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn(styles.actions, className)} data-action-group role={role} />;
}

export function SectionHeader({
  eyebrow,
  heading,
  headingId,
  headingAs = 'h2',
  headingVariant = 'section',
  children,
  className,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  eyebrow: ReactNode;
  heading: ReactNode;
  headingId?: string;
  headingAs?: 'h1' | 'h2' | 'h3';
  headingVariant?: 'display' | 'page' | 'section' | 'card';
}) {
  return (
    <div {...props} className={cn(styles.sectionHeader, className)} data-section-header>
      <div className={styles.sectionHeaderLead}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading as={headingAs} variant={headingVariant} id={headingId}>{heading}</Heading>
      </div>
      {children ? <div className={styles.sectionHeaderSupport}>{children}</div> : null}
    </div>
  );
}

export function FactList({
  items,
  layout = 'columns',
  className,
  ...props
}: HTMLAttributes<HTMLDListElement> & {
  items: Array<{ label: ReactNode; value: ReactNode }>;
  layout?: 'columns' | 'rows';
}) {
  return (
    <dl
      {...props}
      className={cn(styles.factList, layout === 'columns' && styles.factListColumns, className)}
      data-fact-list={layout}
    >
      {items.map((item, index) => (
        <div className={styles.factItem} key={`${String(item.label)}-${index}`}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type BaseFieldProps = { id: string; label: string; helper?: string; error?: string; className?: string };
export function Field({ id, label, helper, error, className, ...props }: BaseFieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const describedBy = [helper && `${id}-helper`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return <div className={cn(styles.fieldGroup, className)}><label className={styles.label} htmlFor={id}>{label}</label><input id={id} className={cn(styles.input, error && styles.inputError)} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />{helper && <span id={`${id}-helper`} className={styles.helper}>{helper}</span>}{error && <span id={`${id}-error`} className={styles.error} role="alert">{error}</span>}</div>;
}

export function TextareaField({ id, label, helper, error, className, ...props }: BaseFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const describedBy = [helper && `${id}-helper`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return <div className={cn(styles.fieldGroup, className)}><label className={styles.label} htmlFor={id}>{label}</label><textarea id={id} className={cn(styles.input, error && styles.inputError)} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />{helper && <span id={`${id}-helper`} className={styles.helper}>{helper}</span>}{error && <span id={`${id}-error`} className={styles.error} role="alert">{error}</span>}</div>;
}

export function SelectField({ id, label, helper, error, className, children, ...props }: BaseFieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const describedBy = [helper && `${id}-helper`, error && `${id}-error`].filter(Boolean).join(' ') || undefined;
  return <div className={cn(styles.fieldGroup, className)}><label className={styles.label} htmlFor={id}>{label}</label><select id={id} className={cn(styles.input, error && styles.inputError)} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props}>{children}</select>{helper && <span id={`${id}-helper`} className={styles.helper}>{helper}</span>}{error && <span id={`${id}-error`} className={styles.error} role="alert">{error}</span>}</div>;
}

export function CheckboxField({ id, label, ...props }: { id: string; label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className={styles.choice} htmlFor={id}><input id={id} type="checkbox" {...props} /><span>{label}</span></label>;
}

export function RadioGroup({ legend, name, options }: { legend: string; name: string; options: Array<{ label: string; value: string }> }) {
  return <fieldset className={styles.choiceGroup}><legend className={styles.label}>{legend}</legend>{options.map((option) => <label className={styles.choice} key={option.value}><input type="radio" name={name} value={option.value} /><span>{option.label}</span></label>)}</fieldset>;
}

export { styles as foundationStyles };
