'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Image from 'next/image';
import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import type { ConsentCheckResult } from './consentChecker';

type SelectMode = 'single' | 'multi';

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
};

export function ModalSurface({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  className,
}: ModalSurfaceProps) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="start-modal-overlay fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px]" />
        <div className="fixed inset-0 z-[90] flex items-end justify-center p-4 md:items-center">
          <Dialog.Content
            onCloseAutoFocus={(event) => {
              const previous = previousFocusRef.current;
              if (previous && typeof previous.focus === 'function') {
                event.preventDefault();
                previous.focus({ preventScroll: true });
              }
            }}
            className={`start-modal-content relative flex h-[90vh] w-[min(1120px,calc(100vw-32px))] max-h-[90vh] flex-col overflow-hidden rounded-t-3xl border border-neutral-200 bg-white shadow-2xl outline-none md:h-auto md:max-h-[min(88vh,calc(100vh-32px))] md:rounded-2xl ${
              className ?? ''
            }`}
          >
            <div className="relative border-b border-border px-8 py-6">
              <div className="space-y-2 pr-16">
                <Dialog.Title className="text-[24px] font-semibold leading-[1.25] text-neutral-900">
                  {title}
                </Dialog.Title>
                {description ? (
                  <Dialog.Description className="text-base leading-7 text-neutral-700">
                    {description}
                  </Dialog.Description>
                ) : null}
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close"
                  className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-neutral-700 transition hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </Dialog.Close>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-8 text-base leading-7 text-neutral-800">{children}</div>

            {footer ? <div className="start-modal-footer shrink-0">{footer}</div> : null}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

type ModalActionBarProps = {
  selectionLabel: string;
  primaryLabel: string;
  primaryDisabled: boolean;
  onPrimary: () => void;
  secondaryLabel?: string;
  secondaryDisabled?: boolean;
  onSecondary?: () => void;
  extraActions?: ReactNode;
};

export function ModalActionBar({
  selectionLabel,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  secondaryLabel,
  secondaryDisabled = false,
  onSecondary,
  extraActions,
}: ModalActionBarProps) {
  return (
    <div className="start-modal-action-bar sticky bottom-0 relative border-t border-neutral-200 bg-white/85 px-5 py-4 shadow-[0_-16px_34px_-28px_rgba(15,23,42,0.7)] backdrop-blur md:px-8 md:py-5">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-4 h-4 bg-gradient-to-t from-white/75 to-transparent" />
      <div className="relative flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <p className="text-sm font-medium text-neutral-700">{selectionLabel}</p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {extraActions}
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              disabled={secondaryDisabled}
              className="rounded border border-border bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:border-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {secondaryLabel}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onPrimary}
            disabled={primaryDisabled}
            className="rounded border border-black bg-black px-5 py-2.5 text-sm font-medium text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type ConditionalSubPanelOption<OptionId extends string> = {
  id: OptionId;
  label: string;
  description?: string;
};

type ConditionalSubPanelProps<OptionId extends string> = {
  title?: string;
  helperText?: string;
  options: ReadonlyArray<ConditionalSubPanelOption<OptionId>>;
  value: OptionId | null;
  onChange: (id: OptionId) => void;
};

export function ConditionalSubPanel<OptionId extends string>({
  title = 'Refine this choice (optional)',
  helperText = "You can skip this; we'll confirm in consultation.",
  options,
  value,
  onChange,
}: ConditionalSubPanelProps<OptionId>) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-neutral-50 px-4 py-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        <p className="text-sm text-neutral-600">{helperText}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={`rounded-lg border px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
                selected ? 'border-black bg-black text-white' : 'border-border bg-white text-neutral-800 hover:border-neutral-500'
              }`}
            >
              <p className="text-sm font-medium">{option.label}</p>
              {option.description ? (
                <p className={`mt-1 text-xs ${selected ? 'text-white/85' : 'text-neutral-600'}`}>{option.description}</p>
              ) : null}
            </button>
          );
        })}
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
            className={`rounded-full border px-3 py-1.5 text-[13px] font-medium uppercase tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 ${
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
  exampleUseCase: string;
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
  renderSubPanel?: (tabId: T) => ReactNode;
  primaryCtaLabel?: string;
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
  renderSubPanel,
  primaryCtaLabel = 'Confirm & continue',
  canContinue = true,
}: TabbedOptionModalProps<T>) {
  const activeOption =
    options.find((option) => option.id === activeTabId) ??
    options[0];
  const selectedOption =
    selectedDraftId == null
      ? null
      : options.find((option) => option.id === selectedDraftId) ?? null;

  if (!activeOption) return null;

  const activeSelected = selectedDraftId === activeOption.id;
  const selectionLabel = selectedOption ? `Selected: ${selectedOption.label}` : 'Choose an option to continue';

  return (
    <ModalSurface
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <ModalActionBar
          selectionLabel={selectionLabel}
          primaryLabel={primaryCtaLabel}
          primaryDisabled={!canContinue}
          onPrimary={onContinue}
          secondaryLabel={activeSelected ? undefined : 'Select this option'}
          onSecondary={activeSelected ? undefined : () => onSelect(activeOption.id)}
        />
      }
    >
      <div className="space-y-6">
        <Tabs
          ariaLabel={`${title} options`}
          tabs={options.map((option) => ({ id: option.id, label: option.label }))}
          activeId={activeTabId}
          onChange={onTabChange}
        />

        <section id={`tabpanel-${activeOption.id}`} role="tabpanel" aria-labelledby={`tab-${activeOption.id}`} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.06fr)] lg:items-start">
            <div className="overflow-hidden rounded-xl border border-border bg-neutral-100">
              <div className="relative aspect-[3/2]">
                <Image
                  src={activeOption.image.src}
                  alt={activeOption.image.alt}
                  fill
                  sizes="(max-width: 1023px) 100vw, 44vw"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-base leading-7 text-neutral-800">{activeOption.summary}</p>
              {activeOption.bestFor?.length ? (
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Best for</p>
                  <ul className="list-disc space-y-1.5 pl-5 text-base leading-7 text-neutral-700">
                    {activeOption.bestFor.slice(0, 3).map((item) => (
                      <li key={`${activeOption.id}-best-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {activeOption.consider?.length ? (
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Consider</p>
                  <ul className="list-disc space-y-1.5 pl-5 text-base leading-7 text-neutral-700">
                    {activeOption.consider.slice(0, 2).map((item) => (
                      <li key={`${activeOption.id}-consider-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {activeOption.microEducation ? (
                <p className="rounded-lg border border-border bg-neutral-50 px-4 py-3 text-base leading-7 text-neutral-700">
                  {activeOption.microEducation}
                </p>
              ) : null}
              <div className="space-y-2">
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Example use case</p>
                <p className="text-base leading-7 text-neutral-700">{activeOption.exampleUseCase}</p>
              </div>
              {activeOption.worksWellWith?.length ? (
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Works well with</p>
                  <div className="flex flex-wrap gap-2">
                    {activeOption.worksWellWith.map((item) => (
                      <span
                        key={`${activeOption.id}-works-${item}`}
                        className="rounded-full border border-border bg-neutral-50 px-2.5 py-1 text-[13px] leading-5 text-neutral-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {renderSubPanel ? renderSubPanel(activeOption.id) : null}
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
  worksWellWith?: ReadonlyArray<string>;
  microEducation?: string;
  exampleUseCase: string;
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
  onPrimary: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
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
  onPrimary,
  primaryLabel = 'Continue to Timeframe',
  primaryDisabled,
}: ExtrasExplorerModalProps<T>) {
  const activeOption =
    options.find((option) => option.id === activeExtraId) ??
    options[0];

  if (!activeOption) return null;

  const selectedOptionLabels = options
    .filter((option) => selectedExtraIds.includes(option.id))
    .map((option) => option.label);

  const activeSelected = selectedExtraIds.includes(activeOption.id);
  const hasSelection = noExtras || selectedExtraIds.length > 0;
  const resolvedPrimaryDisabled = primaryDisabled ?? !hasSelection;
  const selectedSummary =
    selectedOptionLabels.length <= 1
      ? selectedOptionLabels[0]
      : `${selectedOptionLabels[0]} +${selectedOptionLabels.length - 1} more`;
  const selectionLabel = noExtras
    ? 'Selected: No extras right now'
    : selectedOptionLabels.length
      ? `Selected: ${selectedSummary}`
      : 'Choose an option to continue';
  const secondaryLabel = noExtras
    ? 'Add this extra'
    : activeSelected
      ? 'Remove extra'
      : 'Add this extra';

  return (
    <ModalSurface
      open={open}
      title={title}
      description="Add or remove extras in one session, then continue when your selection is ready."
      onClose={onClose}
      footer={
        <ModalActionBar
          selectionLabel={selectionLabel}
          primaryLabel={primaryLabel}
          primaryDisabled={resolvedPrimaryDisabled}
          onPrimary={onPrimary}
          secondaryLabel={secondaryLabel}
          onSecondary={() => {
            if (noExtras) {
              onSetNoExtras(false);
              onToggleExtra(activeOption.id);
              return;
            }
            onToggleExtra(activeOption.id);
          }}
          extraActions={
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
          }
        />
      }
    >
      <div className="space-y-6">
        <Tabs
          ariaLabel="Extras"
          tabs={options.map((option) => ({ id: option.id, label: option.label }))}
          activeId={activeOption.id}
          onChange={onActiveExtraChange}
        />

        <section id={`tabpanel-${activeOption.id}`} role="tabpanel" aria-labelledby={`tab-${activeOption.id}`} className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.06fr)] lg:items-start">
            <div className="overflow-hidden rounded-xl border border-border bg-neutral-100">
              <div className="relative aspect-[3/2]">
                <Image
                  src={activeOption.image.src}
                  alt={activeOption.image.alt}
                  fill
                  sizes="(max-width: 1023px) 100vw, 44vw"
                  className="object-cover"
                />
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-base leading-7 text-neutral-800">{activeOption.summary}</p>
              {activeOption.bestFor?.length ? (
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Best for</p>
                  <ul className="list-disc space-y-1.5 pl-5 text-base leading-7 text-neutral-700">
                    {activeOption.bestFor.slice(0, 3).map((item) => (
                      <li key={`${activeOption.id}-best-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {activeOption.consider?.length ? (
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Consider</p>
                  <ul className="list-disc space-y-1.5 pl-5 text-base leading-7 text-neutral-700">
                    {activeOption.consider.slice(0, 2).map((item) => (
                      <li key={`${activeOption.id}-consider-${item}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {activeOption.microEducation ? (
                <p className="rounded-lg border border-border bg-neutral-50 px-4 py-3 text-base leading-7 text-neutral-700">
                  {activeOption.microEducation}
                </p>
              ) : null}
              <div className="space-y-2">
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Example use case</p>
                <p className="text-base leading-7 text-neutral-700">{activeOption.exampleUseCase}</p>
              </div>
              {activeOption.worksWellWith?.length ? (
                <div className="space-y-2">
                  <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-neutral-500">Works well with</p>
                  <div className="flex flex-wrap gap-2">
                    {activeOption.worksWellWith.map((item) => (
                      <span
                        key={`${activeOption.id}-works-${item}`}
                        className="rounded-full border border-border bg-neutral-50 px-2.5 py-1 text-[13px] leading-5 text-neutral-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
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
