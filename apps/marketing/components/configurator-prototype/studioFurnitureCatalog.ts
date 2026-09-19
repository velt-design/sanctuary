/** Full-size illustrative setting envelopes. Routes are reserved separately. */
export const furnitureCatalog = {
  lounge: { size: [3400,2700], seats: 4, use: 'lounge', quality: 12 },
  social: { size: [4600,2100], seats: 5, use: 'lounge', quality: 16 },
  'shallow-social': { size: [4600,1700], seats: 5, use: 'lounge', quality: 12 },
  dining: { size: [2900,2700], seats: 6, use: 'dining', quality: 12 },
  'compact-dining': { size: [2100,2200], seats: 4, use: 'dining', quality: 8 },
  'small-lounge': { size: [2750,1800], seats: 3, use: 'lounge', quality: 8 },
  compact: { size: [2400,1700], seats: 2, use: 'lounge', quality: 5 },
  'sofa-nook': { size: [3000,1300], seats: 3, use: 'lounge', quality: 3 },
  bistro: { size: [1700,1600], seats: 2, use: 'dining', quality: 2 },
  bench: { size: [1800,850], seats: 2, use: 'bench', quality: 0 },
  'bench-social': { size: [3800,850], seats: 4, use: 'bench', quality: 4 },
} as const;
export type FurnitureKind = keyof typeof furnitureCatalog;
