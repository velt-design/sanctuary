const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;
const PAGE_CQW = PAGE_WIDTH / 100;

const BODY_FONT_METRICS = {
  unitsPerEm: 2048,
  ascent: 1984,
  descent: 494,
} as const;

const DISPLAY_FONT_METRICS = {
  unitsPerEm: 1000,
  ascent: 970,
  descent: 250,
} as const;

export type DesignBookletPresentationFontRole = "body" | "display";

function fontMetrics(role: DesignBookletPresentationFontRole) {
  return role === "display" ? DISPLAY_FONT_METRICS : BODY_FONT_METRICS;
}

export function designBookletCssBaselineOffset(
  size: number,
  lineHeight = size,
  role: DesignBookletPresentationFontRole = "body",
): number {
  const metrics = fontMetrics(role);
  const ascent = metrics.ascent / metrics.unitsPerEm;
  const descent = metrics.descent / metrics.unitsPerEm;
  return (lineHeight - (ascent + descent) * size) / 2 + ascent * size;
}

function baselineFromTop(
  top: number,
  size: number,
  lineHeight = size,
  role: DesignBookletPresentationFontRole = "body",
): number {
  return top + designBookletCssBaselineOffset(size, lineHeight, role);
}

const ARTIFACT_INSET = PAGE_CQW * 3.8;
const HEADER_TOP = PAGE_CQW * 3.4;
const BRAND_PRIMARY_SIZE = PAGE_CQW * 1.35;
const BRAND_PRIMARY_LINE_HEIGHT = BRAND_PRIMARY_SIZE;
const HEADER_LABEL_SIZE = PAGE_CQW * 0.7;
const HEADER_LABEL_LINE_HEIGHT = HEADER_LABEL_SIZE;

const FOOTER_LABEL_SIZE = PAGE_CQW * 0.63;
const FOOTER_LABEL_LINE_HEIGHT = FOOTER_LABEL_SIZE * 1.2;
const FOOTER_RULE_TOP =
  PAGE_HEIGHT - PAGE_CQW * 1.8 - FOOTER_LABEL_LINE_HEIGHT - PAGE_CQW * 0.9;
const FOOTER_LABEL_TOP = FOOTER_RULE_TOP + PAGE_CQW * 0.9;

const EYEBROW_SIZE = PAGE_CQW * 0.72;
const EYEBROW_LINE_HEIGHT = EYEBROW_SIZE * 1.2;

const COVER_STORY_WIDTH = PAGE_WIDTH * 0.47;
const COVER_DETAILS_GAP = PAGE_CQW * 2.4;
const COVER_DETAILS_AVAILABLE = COVER_STORY_WIDTH - COVER_DETAILS_GAP;
const COVER_DETAILS_PREPARED_WIDTH = COVER_DETAILS_AVAILABLE * 0.35;
const COVER_DETAILS_DIRECTION_WIDTH = COVER_DETAILS_AVAILABLE * 0.65;

const REVIEW_IMAGE_WIDTH = PAGE_WIDTH * 0.45;
const REVIEW_STORY_WIDTH = PAGE_WIDTH - REVIEW_IMAGE_WIDTH;
const REVIEW_PADDING_X = REVIEW_STORY_WIDTH * 0.094;
const REVIEW_COPY_X = REVIEW_IMAGE_WIDTH + REVIEW_PADDING_X;
const REVIEW_COPY_WIDTH = REVIEW_STORY_WIDTH - REVIEW_PADDING_X * 2;
const REVIEW_EYEBROW_BASELINE = 95.28;
const REVIEW_TITLE_BASELINE = 133.28;
const REVIEW_TITLE_SIZE = 28;
const REVIEW_TITLE_LINE_HEIGHT = 30;
const REVIEW_INTRODUCTION_BASELINE = 194.28;
const REVIEW_INTRODUCTION_SIZE = 9.2;
const REVIEW_INTRODUCTION_LINE_HEIGHT = 13;
const REVIEW_PROMPT_RULE_TOP = 237.28;
const REVIEW_PROMPT_ROW_HEIGHT = 83;
const REVIEW_PROMPT_TITLE_SIZE = 9.5;
const REVIEW_PROMPT_TITLE_LINE_HEIGHT = 11.4;
const REVIEW_PROMPT_TITLE_BASELINE_OFFSET = 21;
const REVIEW_PROMPT_PADDING_TOP =
  REVIEW_PROMPT_TITLE_BASELINE_OFFSET -
  designBookletCssBaselineOffset(
    REVIEW_PROMPT_TITLE_SIZE,
    REVIEW_PROMPT_TITLE_LINE_HEIGHT,
    "display",
  );
const REVIEW_PROMPT_COPY_SIZE = 8.2;
const REVIEW_PROMPT_COPY_LINE_HEIGHT = 11;
const REVIEW_PROMPT_COPY_BASELINE_OFFSET = 41;
const REVIEW_PROMPT_COPY_MARGIN_TOP =
  REVIEW_PROMPT_COPY_BASELINE_OFFSET -
  REVIEW_PROMPT_PADDING_TOP -
  REVIEW_PROMPT_TITLE_LINE_HEIGHT -
  designBookletCssBaselineOffset(
    REVIEW_PROMPT_COPY_SIZE,
    REVIEW_PROMPT_COPY_LINE_HEIGHT,
  );
const REVIEW_CALL_TO_ACTION_BASELINE = 520.28;
const REVIEW_CALL_TO_ACTION_SIZE = 10;
const REVIEW_CALL_TO_ACTION_LINE_HEIGHT = 12;

const DRAWING_SHEET_INSET = 12;
const DRAWING_TITLE_BLOCK_WIDTH = PAGE_WIDTH - DRAWING_SHEET_INSET * 2;
const DRAWING_TITLE_COLUMN_WIDTH = DRAWING_TITLE_BLOCK_WIDTH * 0.42;
const DRAWING_PROJECT_COLUMN_WIDTH = DRAWING_TITLE_BLOCK_WIDTH * 0.21;
const DRAWING_DESIGN_COLUMN_WIDTH = DRAWING_TITLE_BLOCK_WIDTH * 0.23;
const DRAWING_META_COLUMN_WIDTH =
  DRAWING_TITLE_BLOCK_WIDTH -
  DRAWING_TITLE_COLUMN_WIDTH -
  DRAWING_PROJECT_COLUMN_WIDTH -
  DRAWING_DESIGN_COLUMN_WIDTH;

export const DESIGN_BOOKLET_PRESENTATION = {
  page: {
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    previewBorderWidth: 0.65,
  },
  chrome: {
    insetLeft: ARTIFACT_INSET,
    insetRight: ARTIFACT_INSET,
    header: {
      brandPrimaryBaseline: baselineFromTop(
        HEADER_TOP,
        BRAND_PRIMARY_SIZE,
        BRAND_PRIMARY_LINE_HEIGHT,
        "display",
      ),
      brandPrimarySize: BRAND_PRIMARY_SIZE,
      brandPrimaryLineHeight: BRAND_PRIMARY_LINE_HEIGHT,
      labelBaseline: baselineFromTop(
        HEADER_TOP,
        HEADER_LABEL_SIZE,
        HEADER_LABEL_LINE_HEIGHT,
      ),
      labelSize: HEADER_LABEL_SIZE,
      labelLineHeight: HEADER_LABEL_LINE_HEIGHT,
    },
    footer: {
      ruleTop: FOOTER_RULE_TOP,
      ruleWidth: PAGE_WIDTH - ARTIFACT_INSET * 2,
      labelBaseline: baselineFromTop(
        FOOTER_LABEL_TOP,
        FOOTER_LABEL_SIZE,
        FOOTER_LABEL_LINE_HEIGHT,
      ),
      labelSize: FOOTER_LABEL_SIZE,
      labelLineHeight: FOOTER_LABEL_LINE_HEIGHT,
      pageNumberSize: FOOTER_LABEL_SIZE,
    },
  },
  typography: {
    bodyFontMetrics: BODY_FONT_METRICS,
    displayFontMetrics: DISPLAY_FONT_METRICS,
    eyebrowSize: EYEBROW_SIZE,
    eyebrowLineHeight: EYEBROW_LINE_HEIGHT,
  },
  cover: {
    story: {
      x: ARTIFACT_INSET,
      bottom: PAGE_CQW * 6.3,
      width: COVER_STORY_WIDTH,
    },
    eyebrow: {
      size: EYEBROW_SIZE,
      lineHeight: EYEBROW_LINE_HEIGHT,
    },
    title: {
      marginTop: PAGE_CQW * 1.5,
      width: COVER_STORY_WIDTH,
      size: PAGE_CQW * 4.7,
      lineHeight: PAGE_CQW * 4.7 * 0.97,
      maxLines: 3,
    },
    details: {
      marginTop: PAGE_CQW * 3.3,
      paddingTop: PAGE_CQW * 1.35,
      width: COVER_STORY_WIDTH,
      gap: COVER_DETAILS_GAP,
      label: {
        size: PAGE_CQW * 0.67,
        lineHeight: PAGE_CQW * 0.67 * 1.2,
      },
      value: {
        marginTop: PAGE_CQW * 0.6,
        size: PAGE_CQW * 1.02,
        lineHeight: PAGE_CQW * 1.02 * 1.35,
      },
      prepared: {
        width: COVER_DETAILS_PREPARED_WIDTH,
        valueMaxLines: 1,
      },
      direction: {
        x: COVER_DETAILS_PREPARED_WIDTH + COVER_DETAILS_GAP,
        width: COVER_DETAILS_DIRECTION_WIDTH,
        valueMaxLines: 2,
      },
    },
  },
  drawing: {
    area: {
      x: DRAWING_SHEET_INSET,
      top: 12,
      width: PAGE_WIDTH - DRAWING_SHEET_INSET * 2,
      height: 488,
    },
    caption: {
      reserveHeight: 18,
      insetX: 3.5,
      baselineFromBottom: 9.7,
      size: 6.6,
      lineHeight: 7.8,
      maxLines: 1,
    },
    imageBorderWidth: 0.45,
    titleBlock: {
      x: DRAWING_SHEET_INSET,
      top: 512,
      width: DRAWING_TITLE_BLOCK_WIDTH,
      height: 71,
      titleColumnWidth: DRAWING_TITLE_COLUMN_WIDTH,
      projectColumnWidth: DRAWING_PROJECT_COLUMN_WIDTH,
      designColumnWidth: DRAWING_DESIGN_COLUMN_WIDTH,
      metaColumnWidth: DRAWING_META_COLUMN_WIDTH,
      paddingX: 7,
      paddingTop: 5.5,
      brandSize: 7.2,
      brandLineHeight: 7.8,
      brandDescriptorSize: 4,
      brandDescriptorLineHeight: 4.7,
      labelSize: 4.1,
      labelLineHeight: 5,
      valueSize: 5.8,
      valueLineHeight: 6.7,
      titleSize: 14,
      titleLineHeight: 14.5,
      statusSize: 4.2,
      statusLineHeight: 5,
      sheetSize: 16,
      sheetLineHeight: 16,
      outerRuleWidth: 0.65,
      ruleWidth: 0.35,
    },
  },
  review: {
    image: {
      x: 0,
      top: 0,
      width: REVIEW_IMAGE_WIDTH,
      height: PAGE_HEIGHT,
    },
    story: {
      x: REVIEW_IMAGE_WIDTH,
      width: REVIEW_STORY_WIDTH,
    },
    copy: {
      x: REVIEW_COPY_X,
      width: REVIEW_COPY_WIDTH,
    },
    eyebrow: {
      baseline: REVIEW_EYEBROW_BASELINE,
    },
    title: {
      baseline: REVIEW_TITLE_BASELINE,
      size: REVIEW_TITLE_SIZE,
      lineHeight: REVIEW_TITLE_LINE_HEIGHT,
      maxLines: 2,
    },
    introduction: {
      baseline: REVIEW_INTRODUCTION_BASELINE,
      size: REVIEW_INTRODUCTION_SIZE,
      lineHeight: REVIEW_INTRODUCTION_LINE_HEIGHT,
      maxLines: 3,
    },
    prompts: [0, 1, 2].map((index) => ({
      ruleTop: REVIEW_PROMPT_RULE_TOP + REVIEW_PROMPT_ROW_HEIGHT * index,
      rowHeight: REVIEW_PROMPT_ROW_HEIGHT,
      paddingTop: REVIEW_PROMPT_PADDING_TOP,
      numberWidth: REVIEW_COPY_WIDTH * 0.08,
      gap: REVIEW_COPY_WIDTH * 0.04,
      numberSize: 6.16,
      numberLineHeight: 7.4,
      titleSize: REVIEW_PROMPT_TITLE_SIZE,
      titleLineHeight: REVIEW_PROMPT_TITLE_LINE_HEIGHT,
      copyMarginTop: REVIEW_PROMPT_COPY_MARGIN_TOP,
      copySize: REVIEW_PROMPT_COPY_SIZE,
      copyLineHeight: REVIEW_PROMPT_COPY_LINE_HEIGHT,
      copyMaxLines: 2,
    })),
    finalPromptRuleTop: REVIEW_PROMPT_RULE_TOP + REVIEW_PROMPT_ROW_HEIGHT * 3,
    callToAction: {
      baseline: REVIEW_CALL_TO_ACTION_BASELINE,
      size: REVIEW_CALL_TO_ACTION_SIZE,
      lineHeight: REVIEW_CALL_TO_ACTION_LINE_HEIGHT,
    },
  },
} as const;

function normalizeDesignBookletTypographyCharacters(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00a0/g, " ");
}

export function normalizeDesignBookletPresentationText(value: string): string {
  return normalizeDesignBookletTypographyCharacters(value)
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeDesignBookletMultilinePresentationText(
  value: string,
): string {
  return normalizeDesignBookletTypographyCharacters(value)
    .replace(/\r\n?/g, "\n")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
