import {
  DESIGN_BOOKLET_TEXT_SIZE_IDS,
  type DesignBookletImagePage,
} from "@/lib/designBooklets/types";
import {
  DESIGN_BOOKLET_CONTENT_SCALE_RANGES,
  type DesignBookletContentScaleRole,
} from "@/lib/designBooklets/contentPresentation";
import styles from "./designBooklets.module.css";

type EditorialContent = DesignBookletImagePage["content"];

function ScaleControl({
  label,
  role,
  value,
  onChange,
}: {
  label: string;
  role: DesignBookletContentScaleRole;
  value: number;
  onChange: (value: number) => void;
}) {
  const range = DESIGN_BOOKLET_CONTENT_SCALE_RANGES[role];
  return (
    <label className={`${styles.field} ${styles.scaleControl}`}>
      <span>
        {label}
        <output>{value}%</output>
      </span>
      <input
        type="range"
        aria-label={`${label} scale`}
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function ContentTypographyControls({
  content,
  onChange,
}: {
  content: EditorialContent;
  onChange: (content: EditorialContent) => void;
}) {
  const scalesAreDefault =
    content.headlineScale === 100 &&
    content.bodyScale === 100 &&
    content.eyebrowScale === 100 &&
    content.captionScale === 100;
  const updateScale = (
    key: "headlineScale" | "bodyScale" | "eyebrowScale" | "captionScale",
    value: number,
  ) => onChange({ ...content, [key]: value });

  return (
    <section className={styles.typographyControls}>
      <div className={styles.typographyHeading}>
        <div>
          <strong>Typography</strong>
          <span>Presets set the base; sliders fine-tune the printed size.</span>
        </div>
        <button
          type="button"
          disabled={scalesAreDefault}
          onClick={() =>
            onChange({
              ...content,
              headlineScale: 100,
              bodyScale: 100,
              eyebrowScale: 100,
              captionScale: 100,
            })
          }
        >
          Reset sizes
        </button>
      </div>
      <div className={styles.textSizeGrid}>
        <label className={styles.field}>
          <span>Headline base</span>
          <select
            value={content.headlineSize}
            onChange={(event) =>
              onChange({
                ...content,
                headlineSize: event.target
                  .value as EditorialContent["headlineSize"],
              })
            }
          >
            {DESIGN_BOOKLET_TEXT_SIZE_IDS.map((size) => (
              <option key={size} value={size}>
                {size[0].toUpperCase() + size.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Body base</span>
          <select
            value={content.bodySize}
            onChange={(event) =>
              onChange({
                ...content,
                bodySize: event.target.value as EditorialContent["bodySize"],
              })
            }
          >
            {DESIGN_BOOKLET_TEXT_SIZE_IDS.map((size) => (
              <option key={size} value={size}>
                {size[0].toUpperCase() + size.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className={styles.scaleGrid}>
        <ScaleControl
          label="Headline"
          role="headline"
          value={content.headlineScale}
          onChange={(value) => updateScale("headlineScale", value)}
        />
        <ScaleControl
          label="Body"
          role="body"
          value={content.bodyScale}
          onChange={(value) => updateScale("bodyScale", value)}
        />
        <ScaleControl
          label="Eyebrow"
          role="eyebrow"
          value={content.eyebrowScale}
          onChange={(value) => updateScale("eyebrowScale", value)}
        />
        <ScaleControl
          label="Captions"
          role="caption"
          value={content.captionScale}
          onChange={(value) => updateScale("captionScale", value)}
        />
      </div>
    </section>
  );
}
