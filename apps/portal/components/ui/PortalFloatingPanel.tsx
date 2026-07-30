'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import styles from './PortalFloatingPanel.module.css';

type PanelSide = 'bottom' | 'right';
type PanelAlign = 'start' | 'center' | 'end';

type FloatingPanelControls = {
  close: () => void;
};

type PortalFloatingPanelProps = {
  align?: PanelAlign;
  children: ReactNode | ((controls: FloatingPanelControls) => ReactNode);
  contentClassName?: string;
  label: string;
  onOpenChange?: (open: boolean) => void;
  onPanelKeyDown?: (event: KeyboardEvent<HTMLDivElement>, controls: FloatingPanelControls) => void;
  open?: boolean;
  role: 'dialog' | 'menu';
  side?: PanelSide;
  sideOffset?: number;
  trigger: ReactNode;
  triggerAriaLabel?: string;
  triggerClassName?: string;
};

type PortalMenuItem = {
  className?: string;
  disabled?: boolean;
  id: string;
  label: ReactNode;
  onSelect: () => void;
  separatorBefore?: boolean;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function panelPosition(
  trigger: DOMRect,
  panel: DOMRect,
  side: PanelSide,
  align: PanelAlign,
  sideOffset: number,
): CSSProperties {
  const viewportPadding = 8;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  let left: number;
  let top: number;

  if (side === 'right') {
    left = trigger.right + sideOffset;
    if (left + panel.width > viewportWidth - viewportPadding && trigger.left - sideOffset - panel.width >= viewportPadding) {
      left = trigger.left - sideOffset - panel.width;
    }
    top = align === 'start'
      ? trigger.top
      : align === 'center'
        ? trigger.top + (trigger.height - panel.height) / 2
        : trigger.bottom - panel.height;
  } else {
    top = trigger.bottom + sideOffset;
    if (top + panel.height > viewportHeight - viewportPadding && trigger.top - sideOffset - panel.height >= viewportPadding) {
      top = trigger.top - sideOffset - panel.height;
    }
    left = align === 'start'
      ? trigger.left
      : align === 'center'
        ? trigger.left + (trigger.width - panel.width) / 2
        : trigger.right - panel.width;
  }

  return {
    left: clamp(left, viewportPadding, viewportWidth - panel.width - viewportPadding),
    top: clamp(top, viewportPadding, viewportHeight - panel.height - viewportPadding),
  };
}

function PortalFloatingPanel({
  align = 'end',
  children,
  contentClassName,
  label,
  onOpenChange,
  onPanelKeyDown,
  open,
  role,
  side = 'bottom',
  sideOffset = 8,
  trigger,
  triggerAriaLabel,
  triggerClassName,
}: PortalFloatingPanelProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [position, setPosition] = useState<CSSProperties | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const initialMenuFocusRef = useRef<'first' | 'last'>('first');
  const panelId = useId();
  const isOpen = open ?? uncontrolledOpen;

  const setOpen = useCallback((nextOpen: boolean, returnFocus = false) => {
    if (open === undefined) setUncontrolledOpen(nextOpen);
    onOpenChange?.(nextOpen);
    if (!nextOpen) setPosition(null);
    if (returnFocus) queueMicrotask(() => triggerRef.current?.focus());
  }, [onOpenChange, open]);

  const close = useCallback(() => setOpen(false, true), [setOpen]);
  const updatePosition = useCallback(() => {
    const triggerNode = triggerRef.current;
    const panelNode = panelRef.current;
    if (!triggerNode || !panelNode) return;
    setPosition(panelPosition(triggerNode.getBoundingClientRect(), panelNode.getBoundingClientRect(), side, align, sideOffset));
  }, [align, side, sideOffset]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const focusTargets = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(
      role === 'menu'
        ? '[role="menuitem"]:not(:disabled)'
        : 'button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? []);
    const focusTarget = role === 'menu' && initialMenuFocusRef.current === 'last'
      ? focusTargets[focusTargets.length - 1]
      : focusTargets[0];
    focusTarget?.focus();
  }, [isOpen, role, updatePosition]);

  useEffect(() => {
    if (!isOpen) return;
    const onDocumentKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    const onDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('keydown', onDocumentKeyDown);
    document.addEventListener('pointerdown', onDocumentPointerDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      document.removeEventListener('keydown', onDocumentKeyDown);
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [close, isOpen, updatePosition]);

  const controls = { close };
  const panel = isOpen && typeof document !== 'undefined'
    ? createPortal(
        <div
          ref={panelRef}
          id={panelId}
          role={role}
          aria-label={label}
          className={cx(styles.content, contentClassName)}
          style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
          onKeyDown={(event) => onPanelKeyDown?.(event, controls)}
          onBlur={(event) => {
            const nextTarget = event.relatedTarget as Node | null;
            if (nextTarget && (panelRef.current?.contains(nextTarget) || triggerRef.current?.contains(nextTarget))) return;
            setOpen(false);
          }}
        >
          {typeof children === 'function' ? children(controls) : children}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        aria-label={triggerAriaLabel}
        aria-haspopup={role}
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        onClick={() => {
          initialMenuFocusRef.current = 'first';
          setOpen(!isOpen);
        }}
        onKeyDown={(event) => {
          if (role !== 'menu' || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
          event.preventDefault();
          initialMenuFocusRef.current = event.key === 'ArrowUp' ? 'last' : 'first';
          setOpen(true);
        }}
      >
        {trigger}
      </button>
      {panel}
    </>
  );
}

export function PortalMenu({
  align,
  contentClassName,
  items,
  label,
  side,
  sideOffset,
  trigger,
  triggerAriaLabel,
  triggerClassName,
}: {
  align?: PanelAlign;
  contentClassName?: string;
  items: PortalMenuItem[];
  label: string;
  side?: PanelSide;
  sideOffset?: number;
  trigger: ReactNode;
  triggerAriaLabel?: string;
  triggerClassName?: string;
}) {
  const typeaheadRef = useRef('');
  const typeaheadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
  }, []);

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const targets = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'),
    );
    if (!targets.length) return;
    const currentIndex = targets.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? targets.length - 1
        : event.key === 'ArrowDown'
          ? (currentIndex + 1 + targets.length) % targets.length
          : event.key === 'ArrowUp'
            ? (currentIndex - 1 + targets.length) % targets.length
            : -1;
    if (nextIndex >= 0) {
      event.preventDefault();
      targets[nextIndex].focus();
      return;
    }
    if (event.key.length !== 1 || event.altKey || event.ctrlKey || event.metaKey) return;
    typeaheadRef.current += event.key.toLocaleLowerCase();
    if (typeaheadTimerRef.current) clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = setTimeout(() => {
      typeaheadRef.current = '';
      typeaheadTimerRef.current = null;
    }, 500);
    const orderedTargets = [...targets.slice(currentIndex + 1), ...targets.slice(0, currentIndex + 1)];
    const match = orderedTargets.find((target) => target.textContent?.trim().toLocaleLowerCase().startsWith(typeaheadRef.current));
    if (!match) return;
    event.preventDefault();
    match.focus();
  };

  return (
    <PortalFloatingPanel
      role="menu"
      label={label}
      align={align}
      side={side}
      sideOffset={sideOffset}
      trigger={trigger}
      triggerAriaLabel={triggerAriaLabel}
      triggerClassName={triggerClassName}
      contentClassName={contentClassName}
      onPanelKeyDown={moveFocus}
    >
      {({ close }) => items.map((item) => (
        <div key={item.id}>
          {item.separatorBefore ? <div role="separator" className={styles.separator} /> : null}
          <button
            type="button"
            role="menuitem"
            className={cx(styles.item, item.className)}
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              close();
            }}
          >
            {item.label}
          </button>
        </div>
      ))}
    </PortalFloatingPanel>
  );
}

export function PortalPopover(props: Omit<PortalFloatingPanelProps, 'role'>) {
  return <PortalFloatingPanel {...props} role="dialog" />;
}

export function PortalPanelLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.label, className)}>{children}</div>;
}

export function PortalPanelSeparator({ className }: { className?: string }) {
  return <div role="separator" className={cx(styles.separator, className)} />;
}

export function PortalPanelAction({
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cx(styles.item, className)} {...props} />;
}
