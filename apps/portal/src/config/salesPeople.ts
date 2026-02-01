export type SalesPerson = {
  id: string;
  name: string;
};

export const SALES_PEOPLE: readonly SalesPerson[] = [
  { id: 'steve', name: 'Steve' },
  { id: 'bruce', name: 'Bruce' },
] as const;
