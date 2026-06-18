import { QUOTE_MULTIPLIER, toIndicativeRangeOneSided, toIndicativeSingleAmount, type EnquiryType, type MoneyRange } from './enquiryEstimate';

type EnquiryBudgets = {
  baseRange: MoneyRange | null;
  blindsRange: MoneyRange | null;
  budgetBasis: string | null;
};

export function buildEnquiryBudgets(params: {
  enquiryType: string;
  baseTrueCostIncGst: number | null;
  blindsQuoteIncGst: number | null;
}): EnquiryBudgets {
  if (params.enquiryType !== 'residential' && params.enquiryType !== 'commercial') {
    return { baseRange: null, blindsRange: null, budgetBasis: null };
  }

  const enquiryType = params.enquiryType as EnquiryType;
  const baseRange = params.baseTrueCostIncGst ? toIndicativeSingleAmount(params.baseTrueCostIncGst, enquiryType) : null;

  const blindsTrueCostIncGst = params.blindsQuoteIncGst ? params.blindsQuoteIncGst / QUOTE_MULTIPLIER : null;
  const blindsRange = blindsTrueCostIncGst ? toIndicativeRangeOneSided(blindsTrueCostIncGst, enquiryType) : null;

  let budgetBasis: string | null = null;
  if (baseRange && blindsRange) {
    budgetBasis =
      'website ballpark: base uses 1.20x true cost lower-only, blinds use 1.20x true cost baseline->+15%, fascia assumption';
  } else if (baseRange) {
    budgetBasis = 'website ballpark: base uses 1.20x true cost lower-only, fascia assumption';
  } else if (blindsRange) {
    budgetBasis = 'website ballpark: blinds use 1.20x true cost baseline->+15%';
  }

  return { baseRange, blindsRange, budgetBasis };
}
