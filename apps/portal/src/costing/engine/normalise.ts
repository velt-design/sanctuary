export function normaliseProfile(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/×/g, 'x')
    .replace(/\s+/g, '');
}

export function normaliseColour(raw: string): string {
  const c = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  if (c === 'matte black' || c === 'matt black') return 'black';
  return c;
}

