import type { ImpactDiff } from './diff';

type PriceImpactCategory = {
  id: 'materials' | 'install' | 'overhead';
  label: string;
  value: number;
};

type PriceImpactPresentation = {
  totalInc: number | undefined;
  totalEx: number | undefined;
  categories: PriceImpactCategory[];
  crewHours: number | undefined;
  installDays: number | undefined;
};

const MINIMUM_VISIBLE_DELTA = 0.005;

function finiteNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function formatImpactMoney(value?: number): string {
  const finiteValue = finiteNumber(value);
  if (finiteValue === undefined) return '—';
  if (Math.abs(finiteValue) < MINIMUM_VISIBLE_DELTA) return '$0.00';
  const sign = finiteValue > 0 ? '+' : '-';
  return `${sign}$${Math.abs(finiteValue).toFixed(2)}`;
}

export function formatImpactNumber(value?: number, suffix = ''): string {
  const finiteValue = finiteNumber(value);
  if (finiteValue === undefined) return '—';
  if (Math.abs(finiteValue) < MINIMUM_VISIBLE_DELTA) return suffix ? `0 ${suffix}` : '0';
  const sign = finiteValue > 0 ? '+' : '-';
  const body = Math.abs(finiteValue).toFixed(suffix ? 0 : 2);
  return suffix ? `${sign}${body} ${suffix}` : `${sign}${body}`;
}

export function buildPriceImpactPresentation(diff: ImpactDiff): PriceImpactPresentation {
  const categoryCandidates: PriceImpactCategory[] = [
    { id: 'materials', label: 'Materials', value: diff.delta.materials_ex ?? 0 },
    { id: 'install', label: 'Install', value: diff.delta.install_ex ?? 0 },
    { id: 'overhead', label: 'Overhead', value: diff.delta.overhead_ex ?? 0 },
  ];
  const categories = categoryCandidates
    .filter((category) => Number.isFinite(category.value) && Math.abs(category.value) >= MINIMUM_VISIBLE_DELTA)
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
    .slice(0, 3);

  return {
    totalInc: finiteNumber(diff.delta.total_inc),
    totalEx: finiteNumber(diff.delta.total_ex),
    categories,
    crewHours: finiteNumber(diff.delta.crew_hours),
    installDays: finiteNumber(diff.delta.install_days),
  };
}
