'use client';
import { useState } from 'react';
import { usePreviewBlinds } from './PreviewBlindProvider';
import type { PreviewRoofChoices } from './GableChoices';
import { applySideTreatment, sideTreatmentAt, type SideTreatment } from './sideTreatment';

export function useMobileSides(roof: PreviewRoofChoices, onChange: (roof: PreviewRoofChoices) => void) {
  const workspace = usePreviewBlinds()!;
  const [phase, setPhase] = useState<'opening' | 'finish' | 'preview'>('opening');
  const [ids, setIds] = useState<string[]>([]);
  const [kind, setKind] = useState<SideTreatment | null>(null);
  const selected = ids.filter(id => workspace.openings.some(o => o.id === id));
  const result = kind ? applySideTreatment(roof, workspace.openings, selected, kind) : null;
  function start(initial: string[] = []) { setIds(initial); setKind(null); setPhase('opening'); workspace.setEditing(false); }
  function choose() {
    const kinds = selected.map(id => sideTreatmentAt(roof, id));
    setKind(kinds.every(k => k === kinds[0]) ? kinds[0] ?? null : null); setPhase('finish');
  }
  function apply() {
    if (!result || result.issues.length) return;
    onChange(result.roof); workspace.setEditing(false); setPhase('preview');
  }
  return { phase, setPhase, selected, kind, setKind, start, choose, apply, issues: result?.issues ?? [],
    canApply: Boolean(result && !result.issues.length),
    toggle: (id: string) => setIds(value => value.includes(id) ? value.filter(v => v !== id) : [...value, id]) };
}
