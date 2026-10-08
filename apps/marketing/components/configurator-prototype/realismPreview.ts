/** Production presentation is always enhanced; only local development can compare baseline. */
export function isBaselineScene(search: string, development: boolean): boolean {
  return development && new URLSearchParams(search).get('render') === 'baseline';
}
