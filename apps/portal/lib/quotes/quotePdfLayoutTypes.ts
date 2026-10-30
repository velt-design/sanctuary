import type { RuleDrawn, TableBounds, TotalsBounds } from "./pdfLayout";

export type QuotePdfLayoutPage = {
  hasPageBackground: boolean;
  hasLeftRail: boolean;
  pageNumber: number;
  contentBottomY?: number;
  headerClientName?: { text: string; xRight: number; y: number };
  headerClientAddress?: { lines: string[]; xRight: number; y: number };
  headerWarehouseAddress?: { lines: string[]; xRight: number; y: number };
  tableBounds?: TableBounds | null;
  totalsBounds?: TotalsBounds | null;
  paymentBlock?: { topY: number; bottomY: number; lineCount: number };
  termLineCount?: number;
  termsHeadingY?: number;
  rowHeadingBounds?: Array<{
    baselineY: number;
    topY: number;
    precedingRuleY: number;
  }>;
  rules: RuleDrawn[];
};

export type QuotePdfLayout = {
  pages: QuotePdfLayoutPage[];
};
