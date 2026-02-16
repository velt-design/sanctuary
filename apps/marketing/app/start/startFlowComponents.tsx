'use client';

import Image from 'next/image';
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { ConsentCheckResult } from './consentChecker';

type SelectMode = 'single' | 'multi';

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (element) => !element.hasAttribute('hidden') && element.tabIndex !== -1 && element.offsetParent !== null
  );
}

export type OptionCardOption<T extends string> = {
  value: T;
  title: string;
  summary?: string;
  tags?: string[];
  image: {
    src: string;
    alt: string;
  };
};

type OptionCardProps<T extends string> = {
  mode: SelectMode;
  name: string;
  option: OptionCardOption<T>;
  checked: boolean;
  onChange: (checked: boolean) => void;
  onOpen?: () => void;
  inputRef?: (node: HTMLInputElement | null) => void;
};

export function OptionCard<T extends string>({
  mode,
  name,
  option,
  checked,
  onChange,
  onOpen,
  inputRef,
}: OptionCardProps<T>) {
  const inputType = mode === 'single' ? 'radio' : 'checkbox';
  const indicatorText = checked ? 'Selected' : 'View details';

  return (
    <label
      className="group block cursor-pointer rounded-2xl"
      onClick={() => {
        onOpen?.();
      }}
    >
      <input
        ref={inputRef}
        type={inputType}
        name={name}
        value={option.value}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <div
        className={`relative h-full overflow-hidden rounded-2xl border bg-white transition-all duration-300 motion-reduce:transition-none peer-focus-visible:ring-2 peer-focus-visible:ring-black/30 ${
          checked
            ? 'border-black shadow-[0_8px_24px_-18px_rgba(17,24,39,0.85)]'
            : 'border-border group-hover:-translate-y-0.5 group-hover:border-neutral-400 group-hover:shadow-[0_14px_32px_-24px_rgba(15,23,42,0.7)]'
        }`}
      >
        <div className="relative aspect-[5/4] w-full overflow-hidden bg-neutral-100">
          <Image src={option.image.src} alt={option.image.alt} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent" />
          <span
            aria-hidden="true"
            className={`absolute right-3 top-3 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition ${
              checked ? 'border-black bg-black text-white' : 'border-white bg-white/92 text-neutral-700'
            }`}
          >
            {indicatorText}
          </span>
        </div>
        <div className="space-y-2 p-4">
          <p className="text-sm font-semibold text-neutral-900">{option.title}</p>
          {option.summary ? <p className="text-sm text-neutral-700">{option.summary}</p> : null}
          {option.tags?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {option.tags.map((tag) => (
                <span
                  key={`${option.value}-${tag}`}
                  className="rounded-full border border-border bg-neutral-50 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-neutral-600"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </label>
  );
}

type OptionCardGroupProps<T extends string> = {
  mode: SelectMode;
  name: string;
  ariaLabel: string;
  options: ReadonlyArray<OptionCardOption<T>>;
  selectedValues: ReadonlyArray<T>;
  onSelectionChange: (value: T, checked: boolean) => void;
  onOptionOpen?: (value: T) => void;
  columnsClassName?: string;
};

export function OptionCardGroup<T extends string>({
  mode,
  name,
  ariaLabel,
  options,
  selectedValues,
  onSelectionChange,
  onOptionOpen,
  columnsClassName = 'grid gap-3 md:grid-cols-2',
}: OptionCardGroupProps<T>) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (mode !== 'single') return;
    if (!options.length) return;

    const selected = selectedValues[0];
    const selectedIndex = selected == null ? -1 : options.findIndex((option) => option.value === selected);
    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;

    const maxIndex = options.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = maxIndex;
    if (nextIndex == null) return;

    event.preventDefault();
    const option = options[nextIndex];
    onSelectionChange(option.value, true);
    window.requestAnimationFrame(() => {
      inputRefs.current[nextIndex]?.focus();
    });
  };

  return (
    <div role={mode === 'single' ? 'radiogroup' : 'group'} aria-label={ariaLabel} onKeyDown={handleKeyDown} className={columnsClassName}>
      {options.map((option, index) => {
        const checked = selectedValues.includes(option.value);
        return (
          <OptionCard
            key={option.value}
            mode={mode}
            name={name}
            option={option}
            checked={checked}
            onChange={(isChecked) => onSelectionChange(option.value, isChecked)}
            onOpen={() => onOptionOpen?.(option.value)}
            inputRef={(node) => {
              inputRefs.current[index] = node;
            }}
          />
        );
      })}
    </div>
  );
}

type StepSectionProps = {
  id: string;
  stepLabel: string;
  title: string;
  intro?: string;
  helper?: string;
  isExpanded: boolean;
  isComplete: boolean;
  sectionRef?: (node: HTMLElement | null) => void;
  collapsedSummary?: ReactNode;
  onChange?: () => void;
  canContinue?: boolean;
  onContinue?: () => void;
  continueLabel?: string;
  children?: ReactNode;
};

export function StepSection({
  id,
  stepLabel,
  title,
  intro,
  helper,
  isExpanded,
  isComplete,
  sectionRef,
  collapsedSummary,
  onChange,
  canContinue = false,
  onContinue,
  continueLabel = 'Continue',
  children,
}: StepSectionProps) {
  return (
    <section id={`start-${id}`} ref={sectionRef} className="scroll-mt-24 rounded-2xl border border-border bg-white start-step-shell">
      <div className="space-y-4 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">{stepLabel}</p>
            <h2
              tabIndex={-1}
              data-step-heading="true"
              className="text-xl font-semibold text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-black/30"
            >
              {title}
            </h2>
            {intro ? <p className="max-w-3xl text-sm text-neutral-700">{intro}</p> : null}
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
            {isExpanded ? 'Current' : isComplete ? 'Complete' : 'Upcoming'}
          </p>
        </div>

        {isExpanded ? (
          <div className="start-step-expanded space-y-4">
            {helper ? <p className="text-xs text-neutral-600">{helper}</p> : null}
            <div className="space-y-4">{children}</div>
            {onContinue ? (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={onContinue}
                  disabled={!canContinue}
                  className="rounded border border-black bg-black px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {continueLabel}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {!isExpanded && isComplete ? (
          <div className="start-step-collapsed rounded-xl border border-border bg-neutral-50 px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-[0.12em] text-neutral-500">Saved choice</p>
                <div className="mt-1 text-sm text-neutral-800">{collapsedSummary}</div>
              </div>
              {onChange ? (
                <button
                  type="button"
                  onClick={onChange}
                  className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-700 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                >
                  Change
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

type ModalSurfaceProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  mobileFullScreen?: boolean;
};

export function ModalSurface({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  className,
  mobileFullScreen = false,
}: ModalSurfaceProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFirstElement = () => {
      const focusables = getFocusableElements(panelRef.current);
      if (focusables.length) {
        focusables[0]?.focus({ preventScroll: true });
        return;
      }
      panelRef.current?.focus({ preventScroll: true });
    };

    const frame = window.requestAnimationFrame(focusFirstElement);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!open) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusables = getFocusableElements(panelRef.current);
      if (!focusables.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (!current || current === first || !panelRef.current?.contains(current)) {
          event.preventDefault();
          last.focus();
        }
      } else if (!current || current === last || !panelRef.current?.contains(current)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleKeyDown);

      const previous = previousFocusRef.current;
      if (previous && typeof previous.focus === 'function') {
        try {
          previous.focus({ preventScroll: true });
        } catch {
          // no-op if the element no longer exists in DOM
        }
      }
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[1px] modal-overlay-fade"
      />
      <div className="absolute inset-0 flex items-end justify-center p-0 md:items-center md:p-5">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className={`relative flex w-full flex-col bg-white shadow-2xl outline-none ${
            mobileFullScreen
              ? 'h-[100dvh] rounded-none md:h-auto md:max-h-[88vh] md:max-w-[980px] md:rounded-2xl'
              : 'max-h-[90dvh] rounded-t-3xl md:max-h-[88vh] md:max-w-[980px] md:rounded-2xl'
          } ${className ?? ''} start-modal-panel`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="space-y-1">
              <p className="text-base font-semibold text-neutral-900">{title}</p>
              {description ? <p className="text-sm text-neutral-700">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-border bg-white px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
            >
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer ? <div className="sticky bottom-0 border-t border-border bg-white px-5 py-3">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

export type TabOption<T extends string> = {
  id: T;
  label: string;
};

type TabsProps<T extends string> = {
  ariaLabel: string;
  tabs: ReadonlyArray<TabOption<T>>;
  activeId: T;
  onChange: (id: T) => void;
};

export function Tabs<T extends string>({ ariaLabel, tabs, activeId, onChange }: TabsProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!tabs.length) return;
    const currentIndex = Math.max(
      0,
      tabs.findIndex((tab) => tab.id === activeId)
    );

    const maxIndex = tabs.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight') nextIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
    if (event.key === 'ArrowLeft') nextIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = maxIndex;
    if (nextIndex == null) return;

    event.preventDefault();
    const next = tabs[nextIndex];
    onChange(next.id);
    window.requestAnimationFrame(() => refs.current[nextIndex]?.focus());
  };

  return (
    <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-2" onKeyDown={onKeyDown}>
      {tabs.map((tab, index) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            ref={(node) => {
              refs.current[index] = node;
            }}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
              selected ? 'border-black bg-black text-white' : 'border-border bg-white text-neutral-700 hover:border-neutral-500'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export type TabbedModalOption<T extends string> = {
  id: T;
  label: string;
  summary: string;
  image: {
    src: string;
    alt: string;
  };
  bestFor?: ReadonlyArray<string>;
  consider?: ReadonlyArray<string>;
  worksWellWith?: ReadonlyArray<string>;
  microEducation?: string;
};

type TabbedOptionModalProps<T extends string> = {
  open: boolean;
  title: string;
  description?: string;
  options: ReadonlyArray<TabbedModalOption<T>>;
  activeTabId: T;
  selectedDraftId: T | null;
  onTabChange: (id: T) => void;
  onSelect: (id: T) => void;
  onClose: () => void;
  onContinue: () => void;
  continueLabel?: string;
  canContinue?: boolean;
};

export function TabbedOptionModal<T extends string>({
  open,
  title,
  description,
  options,
  activeTabId,
  selectedDraftId,
  onTabChange,
  onSelect,
  onClose,
  onContinue,
  continueLabel = 'Continue',
  canContinue = true,
}: TabbedOptionModalProps<T>) {
  const activeOption =
    options.find((option) => option.id === activeTabId) ??
    options[0];

  if (!activeOption) return null;

  return (
    <ModalSurface
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-border bg-white px-4 py-2 text-sm font-medium text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="rounded border border-black bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {continueLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Tabs
          ariaLabel={`${title} options`}
          tabs={options.map((option) => ({ id: option.id, label: option.label }))}
          activeId={activeTabId}
          onChange={onTabChange}
        />

        <section id={`tabpanel-${activeOption.id}`} role="tabpanel" aria-labelledby={`tab-${activeOption.id}`} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="overflow-hidden rounded-xl border border-border bg-neutral-100">
              <div className="relative aspect-[4/3]">
                <Image src={activeOption.image.src} alt={activeOption.image.alt} fill sizes="260px" className="object-cover" />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-neutral-800">{activeOption.summary}</p>
              {activeOption.bestFor?.length ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Best for</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                    {activeOption.bestFor.map((item) => (
                      <li key={`${activeOption.id}-best-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {activeOption.consider?.length ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Consider</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                    {activeOption.consider.map((item) => (
                      <li key={`${activeOption.id}-consider-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {activeOption.worksWellWith?.length ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Works well with</p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeOption.worksWellWith.map((item) => (
                      <span
                        key={`${activeOption.id}-works-${item}`}
                        className="rounded-full border border-border bg-neutral-50 px-2 py-1 text-[10px] uppercase tracking-[0.1em] text-neutral-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {activeOption.microEducation ? (
                <p className="rounded-lg border border-border bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{activeOption.microEducation}</p>
              ) : null}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onSelect(activeOption.id)}
            className={`rounded border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
              selectedDraftId === activeOption.id
                ? 'border-black bg-black text-white'
                : 'border-border bg-white text-neutral-800 hover:border-neutral-500'
            }`}
          >
            {selectedDraftId === activeOption.id ? 'Selected' : 'Select this option'}
          </button>
        </section>
      </div>
    </ModalSurface>
  );
}

export type ExtrasExplorerOption<T extends string> = {
  id: T;
  label: string;
  summary: string;
  image: {
    src: string;
    alt: string;
  };
  bestFor?: ReadonlyArray<string>;
  consider?: ReadonlyArray<string>;
  microEducation?: string;
};

type ExtrasExplorerModalProps<T extends string> = {
  open: boolean;
  title: string;
  options: ReadonlyArray<ExtrasExplorerOption<T>>;
  activeExtraId: T;
  selectedExtraIds: ReadonlyArray<T>;
  noExtras: boolean;
  onActiveExtraChange: (id: T) => void;
  onToggleExtra: (id: T) => void;
  onSetNoExtras: (value: boolean) => void;
  onClose: () => void;
  onDone: () => void;
  onContinue: () => void;
  canContinue: boolean;
  continueLabel?: string;
};

export function ExtrasExplorerModal<T extends string>({
  open,
  title,
  options,
  activeExtraId,
  selectedExtraIds,
  noExtras,
  onActiveExtraChange,
  onToggleExtra,
  onSetNoExtras,
  onClose,
  onDone,
  onContinue,
  canContinue,
  continueLabel = 'Continue',
}: ExtrasExplorerModalProps<T>) {
  const activeOption =
    options.find((option) => option.id === activeExtraId) ??
    options[0];

  if (!activeOption) return null;

  const activeSelected = selectedExtraIds.includes(activeOption.id);

  return (
    <ModalSurface
      open={open}
      title={title}
      description="Browse all extras here, then continue when your bundle is right."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onDone}
            className="rounded border border-border bg-white px-4 py-2 text-sm font-medium text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
          >
            Done
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={!canContinue}
            className="rounded border border-black bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            {continueLabel}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Tabs
          ariaLabel="Extras"
          tabs={options.map((option) => ({ id: option.id, label: option.label }))}
          activeId={activeOption.id}
          onChange={onActiveExtraChange}
        />

        <section id={`tabpanel-${activeOption.id}`} role="tabpanel" aria-labelledby={`tab-${activeOption.id}`} className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <div className="overflow-hidden rounded-xl border border-border bg-neutral-100">
              <div className="relative aspect-[4/3]">
                <Image src={activeOption.image.src} alt={activeOption.image.alt} fill sizes="260px" className="object-cover" />
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-sm text-neutral-800">{activeOption.summary}</p>
              {activeOption.bestFor?.length ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Best for</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                    {activeOption.bestFor.map((item) => (
                      <li key={`${activeOption.id}-best-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {activeOption.consider?.length ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Consider</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
                    {activeOption.consider.map((item) => (
                      <li key={`${activeOption.id}-consider-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {activeOption.microEducation ? (
                <p className="rounded-lg border border-border bg-neutral-50 px-3 py-2 text-sm text-neutral-700">{activeOption.microEducation}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleExtra(activeOption.id)}
              className={`rounded border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
                activeSelected
                  ? 'border-black bg-black text-white'
                  : 'border-border bg-white text-neutral-800 hover:border-neutral-500'
              }`}
            >
              {activeSelected ? 'Remove extra' : 'Add extra'}
            </button>
            <button
              type="button"
              onClick={() => onSetNoExtras(!noExtras)}
              className={`rounded border px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
                noExtras
                  ? 'border-black bg-black text-white'
                  : 'border-border bg-white text-neutral-800 hover:border-neutral-500'
              }`}
            >
              No extras right now
            </button>
          </div>
        </section>
      </div>
    </ModalSurface>
  );
}

type ConsentResultCardProps = {
  ready: boolean;
  result: ConsentCheckResult;
  links: ReadonlyArray<{ label: string; href: string }>;
  disclaimer: string;
  ctaLabel: string;
  ctaHref?: string;
};

export function ConsentResultCard({ ready, result, links, disclaimer, ctaLabel, ctaHref = '#start-submit' }: ConsentResultCardProps) {
  if (!ready) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-neutral-50 p-4">
        <p className="text-base font-semibold text-neutral-900">Add dimensions and site basics to run quick-check.</p>
        <p className="text-sm text-neutral-700">
          Once roof setup, attachment, level, public access, and dimensions are in place, this panel updates live.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-neutral-50 p-4">
      <p className="text-base font-semibold text-neutral-900">{result.title}</p>
      <p className="text-sm text-neutral-700">Area calculated: {result.areaM2 == null ? 'unknown' : `${result.areaM2.toFixed(1)}m^2`}.</p>
      <div className="space-y-2">
        <p className="text-sm font-medium text-neutral-900">Why this appears likely</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {result.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-neutral-800">{result.nextStep}</p>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{disclaimer}</p>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={ctaHref}
          className="rounded border border-black bg-black px-4 py-2 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
        >
          {ctaLabel}
        </a>
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}
