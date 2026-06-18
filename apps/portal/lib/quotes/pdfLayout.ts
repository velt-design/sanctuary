import { rgb, type Color, type PDFPage, type PDFFont } from 'pdf-lib';

type BoundsX = { x0: number; x1: number };

export type TableBounds = BoundsX & {
  headerBaselineY: number;
  headerRuleY: number;
  rowRuleYs: number[];
  topY: number;
  bottomY: number;
};

export type TotalsBounds = BoundsX & {
  headerBaselineY: number;
  ceilingRuleY: number;
  subtotalBaselineY: number;
  gstBaselineY: number;
  totalBaselineY: number;
  aboveTotalRuleY: number;
  belowTotalRuleY: number;
};

type RuleStyle = { width: number; color: Color };

const RULE_TIER1: RuleStyle = { width: 1.0, color: rgbFromHex('#C9C9C9') };
const RULE_TIER2: RuleStyle = { width: 0.5, color: rgbFromHex('#D8D8D8') };
const RULE_TIER3: RuleStyle = { width: 0.5, color: rgbFromHex('#E0E0E0') };
const RULE_TABLE_HEADER: RuleStyle = { width: 0.85, color: rgbFromHex('#CFCFCF') };

type RuleKind =
  | 'itemsHeaderUnderline'
  | 'itemsRowSeparator'
  | 'totalsCeiling'
  | 'totalsAboveTotal'
  | 'totalsBelowTotal';

const RULE_KIND_STYLE: Record<RuleKind, RuleStyle> = {
  itemsHeaderUnderline: RULE_TABLE_HEADER,
  itemsRowSeparator: RULE_TIER2,
  totalsCeiling: RULE_TIER1,
  totalsAboveTotal: RULE_TIER3,
  totalsBelowTotal: RULE_TIER3,
};

export type RuleDrawn = {
  kind: RuleKind;
  x0: number;
  x1: number;
  y: number;
  style: RuleStyle;
};

export function drawRule(page: PDFPage, kind: RuleKind, bounds: BoundsX & { y: number }): RuleDrawn {
  const style = RULE_KIND_STYLE[kind];
  page.drawLine({
    start: { x: bounds.x0, y: bounds.y },
    end: { x: bounds.x1, y: bounds.y },
    thickness: style.width,
    color: style.color,
  });

  return { kind, x0: bounds.x0, x1: bounds.x1, y: bounds.y, style };
}

export function drawDebugOverlay(
  page: PDFPage,
  params: { tableBounds?: TableBounds | null; totalsBounds?: TotalsBounds | null; font: PDFFont },
) {
  const labelSize = 6;
  const labelColor = rgb(0.45, 0.45, 0.45);
  const tableColor = rgb(0.25, 0.75, 0.35);
  const totalsColor = rgb(0.25, 0.55, 0.85);

  const drawTick = (x: number, y: number, color: Color, label?: string) => {
    page.drawLine({
      start: { x, y },
      end: { x: x + 6, y },
      thickness: 0.5,
      color,
    });
    if (label) {
      page.drawText(label, { x: x + 8, y: y - 2, size: labelSize, font: params.font, color: labelColor });
    }
  };

  if (params.tableBounds) {
    const { x0, x1, topY, bottomY, headerBaselineY } = params.tableBounds;
    const height = topY - bottomY;
    if (height > 0) {
      page.drawRectangle({
        x: x0,
        y: bottomY,
        width: x1 - x0,
        height,
        borderColor: tableColor,
        borderWidth: 0.5,
      });
    }
    drawTick(x0, headerBaselineY, tableColor, 'itemsHeaderY');
  }

  if (params.totalsBounds) {
    const { x0, x1, ceilingRuleY, belowTotalRuleY, headerBaselineY, totalBaselineY } = params.totalsBounds;
    const height = ceilingRuleY - belowTotalRuleY;
    if (height > 0) {
      page.drawRectangle({
        x: x0,
        y: belowTotalRuleY,
        width: x1 - x0,
        height,
        borderColor: totalsColor,
        borderWidth: 0.5,
      });
    }
    drawTick(x0, headerBaselineY, totalsColor, 'totalsHeaderY');
    drawTick(x0, totalBaselineY, totalsColor, 'totalY');
    drawTick(x0, ceilingRuleY, totalsColor, 'ceilingY');

    page.drawText('totalsX0', { x: x0, y: ceilingRuleY + 2, size: labelSize, font: params.font, color: labelColor });
  }
}

function rgbFromHex(hex: string): Color {
  const value = hex.replace('#', '').trim();
  if (value.length !== 6) return rgb(0, 0, 0);
  const r = Number.parseInt(value.slice(0, 2), 16) / 255;
  const g = Number.parseInt(value.slice(2, 4), 16) / 255;
  const b = Number.parseInt(value.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}
