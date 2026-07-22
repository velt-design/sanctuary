import Image, { type ImageProps } from 'next/image';
import Link from 'next/link';
import type { ComponentPropsWithoutRef, HTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
import styles from './foundation.module.css';

export type ContainerWidth = 'wide' | 'standard' | 'compact' | 'reading';

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
  const variantClass = variant === 'primary' ? styles.buttonPrimary : variant === 'secondary' ? styles.buttonSecondary : styles.buttonOutline;
  return <Link {...props} className={cn(styles.button, variantClass, className)} />;
}

export function TextLink({ className, ...props }: ComponentPropsWithoutRef<typeof Link>) {
  return <Link {...props} className={cn(styles.textLink, className)} />;
}

export function Rule({ className }: { className?: string }) { return <hr className={cn(styles.rule, className)} />; }

export function Figure({ image, alt, caption, detail, ratio = 'landscape', priority = false, sizes, className }: { image: string; alt: string; caption?: string; detail?: string; ratio?: 'landscape' | 'portrait' | 'standard'; priority?: boolean; sizes?: string; className?: string }) {
  const imageProps: Pick<ImageProps, 'quality' | 'sizes'> = { quality: 75, sizes: sizes ?? '(max-width: 700px) 100vw, 66vw' };
  return (
    <figure className={cn(styles.figure, className)}>
      <div className={cn(styles.figureMedia, ratio === 'portrait' && styles.figurePortrait, ratio === 'landscape' && styles.figureLandscape)}>
        <Image src={image} alt={alt} fill priority={priority} {...imageProps} />
      </div>
      {(caption || detail) && <figcaption className={styles.caption}><span>{caption}</span><span>{detail}</span></figcaption>}
    </figure>
  );
}

export function ProjectMeta({ items, className }: { items: string[]; className?: string }) {
  return <ul className={cn(styles.projectMeta, className)}>{items.filter(Boolean).map((item) => <li key={item}>{item}</li>)}</ul>;
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
