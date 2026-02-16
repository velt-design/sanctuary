'use client';

import Image from 'next/image';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import type { ConsentCheckResult } from './consentChecker';

type SelectMode = 'single' | 'multi';

export type SelectCardOption<T extends string> = {
  value: T;
  title: string;
  description?: string;
  bullets?: string[];
  hint?: string;
  tag?: string;
  image: {
    src: string;
    alt: string;
  };
};

type SelectCardProps<T extends string> = {
  mode: SelectMode;
  name: string;
  option: SelectCardOption<T>;
  checked: boolean;
  onSelect: (checked: boolean) => void;
  inputRef?: (node: HTMLInputElement | null) => void;
};

export function SelectCard<T extends string>({
  mode,
  name,
  option,
  checked,
  onSelect,
  inputRef,
}: SelectCardProps<T>) {
  const inputType = mode === 'single' ? 'radio' : 'checkbox';
  const indicatorText = checked ? 'Selected' : mode === 'single' ? 'Select' : 'Add';

  return (
    <label className="block cursor-pointer rounded-xl">
      <input
        ref={inputRef}
        type={inputType}
        name={name}
        value={option.value}
        checked={checked}
        onChange={(event) => onSelect(event.target.checked)}
        className="peer sr-only"
      />
      <div
        className={`relative h-full overflow-hidden rounded-xl border bg-white transition peer-focus-visible:ring-2 peer-focus-visible:ring-black/30 ${
          checked ? 'border-black shadow-sm' : 'border-border hover:border-neutral-400'
        }`}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
          <Image src={option.image.src} alt={option.image.alt} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
          {option.tag ? (
            <span className="absolute left-2 top-2 rounded-full bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-900">
              {option.tag}
            </span>
          ) : null}
          <span
            aria-hidden="true"
            className={`absolute right-2 top-2 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
              checked ? 'border-black bg-black text-white' : 'border-white bg-white/90 text-neutral-700'
            }`}
          >
            {indicatorText}
          </span>
        </div>
        <div className="space-y-2 p-3">
          <p className="text-sm font-semibold text-neutral-900">{option.title}</p>
          {option.description ? <p className="text-sm text-neutral-700">{option.description}</p> : null}
          {option.bullets?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-xs text-neutral-700">
              {option.bullets.map((bullet) => (
                <li key={`${option.value}-${bullet}`}>{bullet}</li>
              ))}
            </ul>
          ) : null}
          {option.hint ? <p className="text-xs text-neutral-600">{option.hint}</p> : null}
        </div>
      </div>
    </label>
  );
}

type SelectCardGroupProps<T extends string> = {
  mode: SelectMode;
  name: string;
  ariaLabel: string;
  options: ReadonlyArray<SelectCardOption<T>>;
  selectedValues: ReadonlyArray<T>;
  onChange: (value: T, checked: boolean) => void;
  columnsClassName?: string;
};

export function SelectCardGroup<T extends string>({
  mode,
  name,
  ariaLabel,
  options,
  selectedValues,
  onChange,
  columnsClassName = 'grid gap-3 md:grid-cols-2',
}: SelectCardGroupProps<T>) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (mode !== 'single') return;

    const selected = selectedValues[0];
    const currentIndex = Math.max(
      0,
      selected == null ? 0 : options.findIndex((option) => option.value === selected)
    );

    const maxIndex = options.length - 1;
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = currentIndex >= maxIndex ? 0 : currentIndex + 1;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = currentIndex <= 0 ? maxIndex : currentIndex - 1;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = maxIndex;
    if (nextIndex == null) return;

    event.preventDefault();
    const next = options[nextIndex];
    onChange(next.value, true);
    window.requestAnimationFrame(() => {
      inputRefs.current[nextIndex]?.focus();
    });
  };

  return (
    <div
      role={mode === 'single' ? 'radiogroup' : 'group'}
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={columnsClassName}
    >
      {options.map((option, index) => {
        const checked = selectedValues.includes(option.value);
        return (
          <SelectCard
            key={option.value}
            mode={mode}
            name={name}
            option={option}
            checked={checked}
            onSelect={(isChecked) => onChange(option.value, isChecked)}
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
  eyebrow?: string;
  title: string;
  intro?: string;
  helper?: string;
  complete?: boolean;
  sectionRef?: (node: HTMLElement | null) => void;
  nextTeaser?: string;
  children: ReactNode;
};

export function StepSection({
  id,
  eyebrow,
  title,
  intro,
  helper,
  complete = false,
  sectionRef,
  nextTeaser,
  children,
}: StepSectionProps) {
  return (
    <section id={`start-${id}`} ref={sectionRef} className="start-step-reveal scroll-mt-24 rounded-xl border border-border bg-white">
      <div className="space-y-4 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            {eyebrow ? <p className="text-xs uppercase tracking-[0.14em] text-neutral-500">{eyebrow}</p> : null}
            <h2
              tabIndex={-1}
              data-step-heading="true"
              className="text-xl font-semibold text-neutral-900 outline-none focus-visible:ring-2 focus-visible:ring-black/30"
            >
              {title}
            </h2>
            {intro ? <p className="max-w-3xl text-sm text-neutral-700">{intro}</p> : null}
          </div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">{complete ? 'Done' : 'Current'}</p>
        </div>
        {helper ? <p className="text-xs text-neutral-600">{helper}</p> : null}
        <div className="space-y-4">{children}</div>
        {nextTeaser ? (
          <p className="rounded-lg border border-border bg-neutral-50 px-3 py-2 text-xs text-neutral-700">{nextTeaser}</p>
        ) : null}
      </div>
    </section>
  );
}

type ConsentResultCardProps = {
  result: ConsentCheckResult;
  links: ReadonlyArray<{ label: string; href: string }>;
  disclaimer: string;
};

export function ConsentResultCard({ result, links, disclaimer }: ConsentResultCardProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-neutral-50 p-4">
      <p className="text-base font-semibold text-neutral-900">{result.title}</p>
      <p className="text-sm text-neutral-700">
        Area calculated: {result.areaM2 == null ? 'unknown' : `${result.areaM2.toFixed(1)}m^2`}.
      </p>
      <div className="space-y-2">
        <p className="text-sm font-medium text-neutral-900">Why we think this</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {result.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </div>
      <p className="text-sm text-neutral-800">{result.nextStep}</p>
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{disclaimer}</p>
      <div className="flex flex-wrap gap-3">
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
