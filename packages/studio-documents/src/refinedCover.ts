import type { PDFFont } from "pdf-lib";
import type {
  StudioClientDocumentSource,
  StudioDocumentPage,
} from "./contract";
import { documentTextLines, compactDocumentSheetTitle } from "./textLayout";
export function refinedCoverLayout(
  source: StudioClientDocumentSource,
  sheets: StudioDocumentPage[],
  font: PDFFont,
  headingFont: PDFFont,
) {
  const heading = documentTextLines(source.projectName, 1108, 28, headingFont),
    documentTitleY = Math.max(
      75,
      36 + Math.max(0, heading.length - 1) * 32 + 28 + 11,
    ),
    ruleY = documentTitleY + 35,
    normalRegisterTop = ruleY + 106;
  const ordinaryHeight = sheets.reduce(
      (sum, sheet) =>
        sum +
        Math.max(
          48,
          documentTextLines(sheet.label, 252, 10, font).length * 13 + 15,
        ),
      0,
    ),
    ordinary = normalRegisterTop + ordinaryHeight <= 664;
  // The exceptional register starts below its heading without the ordinary
  // generous row gap. Keep the same readable glyph size even under an eight-
  // line project title; 22 rows in three columns retain all 65 sheet entries.
  const registerTop = ordinary ? normalRegisterTop : ruleY + 86;
  const compactRowHeight = 12.5;
  const rows = ordinary
      ? sheets.length
      : Math.floor((700 - registerTop) / compactRowHeight),
    columns = ordinary ? 1 : Math.ceil(sheets.length / rows);
  if (rows < 1 || columns > 3)
    throw Error(
      "The complete drawing register exceeds the supported A3 layout",
    );
  const columnWidth = 324 / columns,
    register = sheets.map((sheet, index) => {
      const column = ordinary ? 0 : Math.floor(index / rows),
        row = ordinary ? index : index % rows,
        y = ordinary
          ? registerTop +
            sheets
              .slice(0, index)
              .reduce(
                (sum, s) =>
                  sum +
                  Math.max(
                    48,
                    documentTextLines(s.label, 252, 10, font).length * 13 + 15,
                  ),
                0,
              )
          : registerTop + row * compactRowHeight;
      return {
        sheet,
        x: 824 + column * columnWidth,
        y,
        label: ordinary
          ? sheet.label
          : sheet.kind === "cover"
            ? "Overview/register"
            : compactDocumentSheetTitle(source, sheet),
        width: ordinary ? 252 : columnWidth - 28,
        size: ordinary ? 10 : 8.8,
      };
    });
  return {
    documentTitleY,
    ruleY,
    ordinary,
    registerTop,
    register,
    registerBottom: ordinary
      ? registerTop + ordinaryHeight
      : registerTop + Math.min(rows, sheets.length) * compactRowHeight,
    overview: {
      x: 72,
      y: ruleY + 140,
      width: 680,
      height: Math.max(180, 690 - (ruleY + 140)),
    },
  };
}
