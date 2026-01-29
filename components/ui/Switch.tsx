'use client';

import styles from './Switch.module.css';

type SwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export default function Switch({ checked, onChange, ariaLabel, disabled, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={cx(styles.switch, checked && styles.on, disabled && styles.disabled, className)}
      onClick={() => {
        if (disabled) return;
        onChange(!checked);
      }}
      disabled={disabled}
    >
      <span className={styles.knob} />
    </button>
  );
}

