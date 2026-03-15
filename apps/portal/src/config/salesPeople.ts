export type SalesPerson = {
  id: string;
  name: string;
  shortLabel: string;
};

export const SALES_PEOPLE: readonly SalesPerson[] = [
  { id: 'steve', name: 'Steve', shortLabel: 'SC' },
  { id: 'bruce', name: 'Bruce', shortLabel: 'BB' },
  { id: 'alistair', name: 'Alistair', shortLabel: 'AW' },
  { id: 'jayden', name: 'Jayden', shortLabel: 'JW' },
  { id: 'jesse', name: 'Jesse', shortLabel: 'JI' },
  { id: 'jordan', name: 'Jordan', shortLabel: 'JB' },
  { id: 'david', name: 'David', shortLabel: 'DH' },
] as const;
