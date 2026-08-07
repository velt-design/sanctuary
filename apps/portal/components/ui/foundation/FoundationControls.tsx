'use client';

import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import Link from '@/components/navigation/PortalRouteLink';
import { LoaderCircle } from 'lucide-react';
import styles from './FoundationControls.module.css';

export type ControlSize = 'small' | 'standard' | 'large';

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function controlSizeClass(size: ControlSize): string {
  if (size === 'small') return styles.controlSmall;
  if (size === 'large') return styles.controlLarge;
  return styles.controlStandard;
}

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'quiet' | 'destructive';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ControlSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
};

function buttonClassName({
  variant,
  size,
  fullWidth,
  className,
}: {
  variant: ButtonVariant;
  size: ControlSize;
  fullWidth: boolean;
  className?: string;
}) {
  return cx(
    styles.button,
    styles[`button${variant[0].toUpperCase()}${variant.slice(1)}`],
    controlSizeClass(size),
    fullWidth && styles.fullWidth,
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'standard',
    loading = false,
    leadingIcon,
    trailingIcon,
    fullWidth = false,
    disabled,
    children,
    className,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={buttonClassName({ variant, size, fullWidth, className })}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : leadingIcon}
      <span>{children}</span>
      {!loading ? trailingIcon : null}
    </button>
  );
});

export type ButtonLinkProps = Omit<ComponentProps<typeof Link>, 'href'> & {
  href: string;
  variant?: ButtonVariant;
  size?: ControlSize;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
};

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'standard',
  leadingIcon,
  trailingIcon,
  fullWidth = false,
  disabled = false,
  className,
  children,
  onClick,
  tabIndex,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cx(buttonClassName({ variant, size, fullWidth, className }), disabled && styles.buttonLinkDisabled)}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : tabIndex}
      onClick={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      {leadingIcon}
      <span>{children}</span>
      {trailingIcon}
    </Link>
  );
}

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  'aria-label': string;
  variant?: 'primary' | 'secondary' | 'quiet' | 'inverse';
  size?: ControlSize;
  loading?: boolean;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    variant = 'secondary',
    size = 'standard',
    loading = false,
    disabled,
    children,
    className,
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={cx(
        styles.iconButton,
        styles[`iconButton${variant[0].toUpperCase()}${variant.slice(1)}`],
        controlSizeClass(size),
        className,
      )}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <LoaderCircle className={styles.spinner} aria-hidden="true" /> : children}
    </button>
  );
});

type FieldShellProps = {
  id: string;
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
};

function FieldShell({ id, label, helperText, error, children, className }: FieldShellProps) {
  const messageId = helperText || error ? `${id}-message` : undefined;
  return (
    <div className={cx(styles.field, className)}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      {children}
      {error ? (
        <span className={styles.errorText} id={messageId}>
          {error}
        </span>
      ) : helperText ? (
        <span className={styles.helperText} id={messageId}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
}

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, fieldClassName, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = helperText || error ? `${inputId}-message` : undefined;
  return (
    <FieldShell id={inputId} label={label} helperText={helperText} error={error} className={fieldClassName}>
      <input
        ref={ref}
        id={inputId}
        className={cx(styles.textControl, Boolean(error) && styles.controlError, className)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={messageId}
        {...props}
      />
    </FieldShell>
  );
});

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helperText, error, fieldClassName, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = helperText || error ? `${inputId}-message` : undefined;
  return (
    <FieldShell id={inputId} label={label} helperText={helperText} error={error} className={fieldClassName}>
      <textarea
        ref={ref}
        id={inputId}
        className={cx(styles.textControl, styles.textarea, Boolean(error) && styles.controlError, className)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={messageId}
        {...props}
      />
    </FieldShell>
  );
});

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  helperText?: ReactNode;
  error?: ReactNode;
  fieldClassName?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helperText, error, fieldClassName, id, className, children, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = helperText || error ? `${inputId}-message` : undefined;
  return (
    <FieldShell id={inputId} label={label} helperText={helperText} error={error} className={fieldClassName}>
      <select
        ref={ref}
        id={inputId}
        className={cx(styles.textControl, styles.select, Boolean(error) && styles.controlError, className)}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={messageId}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
});

type ChoiceProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label?: ReactNode;
  description?: ReactNode;
};

export const Checkbox = forwardRef<HTMLInputElement, ChoiceProps>(function Checkbox(
  { label, description, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <label className={cx(styles.choice, className)} htmlFor={inputId}>
      <input ref={ref} id={inputId} className={styles.choiceInput} type="checkbox" {...props} />
      <span className={styles.checkboxMark} aria-hidden="true" />
      {label || description ? <span className={styles.choiceCopy}>
        {label ? <span>{label}</span> : null}
        {description ? <small>{description}</small> : null}
      </span> : null}
    </label>
  );
});

export const Radio = forwardRef<HTMLInputElement, ChoiceProps>(function Radio(
  { label, description, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <label className={cx(styles.choice, className)} htmlFor={inputId}>
      <input ref={ref} id={inputId} className={styles.choiceInput} type="radio" {...props} />
      <span className={styles.radioMark} aria-hidden="true" />
      {label || description ? <span className={styles.choiceCopy}>
        {label ? <span>{label}</span> : null}
        {description ? <small>{description}</small> : null}
      </span> : null}
    </label>
  );
});

export const Switch = forwardRef<HTMLInputElement, ChoiceProps>(function Switch(
  { label, description, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <label className={cx(styles.choice, className)} htmlFor={inputId}>
      <input ref={ref} id={inputId} className={styles.choiceInput} type="checkbox" role="switch" {...props} />
      <span className={styles.switchTrack} aria-hidden="true"><span /></span>
      {label || description ? <span className={styles.choiceCopy}>
        {label ? <span>{label}</span> : null}
        {description ? <small>{description}</small> : null}
      </span> : null}
    </label>
  );
});
