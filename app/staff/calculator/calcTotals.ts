export type AddonsTotals = {
  blinds: { ex: number; inc: number };
  totals: { ex: number; inc: number };
};

export function buildAddonsTotals(blindsEx: number, blindsInc: number): AddonsTotals {
  return {
    blinds: { ex: blindsEx, inc: blindsInc },
    totals: { ex: blindsEx, inc: blindsInc },
  };
}

// Add-ons are quote-stage only; do not include in calculator totals.
export function computeDisplayTotals(coreEx?: number, coreInc?: number, addons?: AddonsTotals) {
  return { coreEx, coreInc, addons };
}
