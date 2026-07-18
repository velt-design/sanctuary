import { describe, expect, it } from 'vitest';
import type { Project } from '@/lib/types/project';
import {
  calculatorProjectPickerViewState,
  filterCalculatorProjects,
} from './CalculatorProjectPicker';

const projects: Project[] = [
  {
    id: 'proj_one',
    createdAt: '2026-07-01T00:00:00.000Z',
    projectName: 'Harbour Pergola',
    quoteRef: 'SP-101',
    siteAddress: '1 Harbour Road',
    status: 'NEW',
  },
  {
    id: 'proj_two',
    createdAt: '2026-07-02T00:00:00.000Z',
    projectName: 'Garden Room',
    quoteRef: 'SP-202',
    siteAddress: '2 Garden Lane',
    status: 'SITE_VISIT',
  },
];

describe('CalculatorProjectPicker', () => {
  it('filters by project name, quote ref, and address without mutating the source list', () => {
    expect(filterCalculatorProjects(projects, 'harbour')).toEqual([projects[0]]);
    expect(filterCalculatorProjects(projects, 'SP-202')).toEqual([projects[1]]);
    expect(filterCalculatorProjects(projects, 'garden lane')).toEqual([projects[1]]);
    expect(filterCalculatorProjects(projects, '')).toBe(projects);
  });

  it('resolves explicit loading, failure, empty, and result states', () => {
    expect(calculatorProjectPickerViewState({ isLoading: true, isError: false, resultCount: 0 })).toBe('loading');
    expect(calculatorProjectPickerViewState({ isLoading: false, isError: true, resultCount: 0 })).toBe('error');
    expect(calculatorProjectPickerViewState({ isLoading: false, isError: false, resultCount: 0 })).toBe('empty');
    expect(calculatorProjectPickerViewState({ isLoading: false, isError: false, resultCount: 2 })).toBe('results');
  });
});
