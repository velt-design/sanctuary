import type { CSSProperties } from "react";
import {
  DESIGN_BOOKLET_BULLET_GEOMETRY,
  DESIGN_BOOKLET_BULLET_GLYPH,
  parseDesignBookletEditorialText,
} from "@/lib/designBooklets/editorialText";
import styles from "./designBookletPages.module.css";

type Props = {
  text: string;
  className: string;
  style: CSSProperties;
};

function point(value: number): string {
  return `calc(var(--booklet-point) * ${value})`;
}

export default function DesignBookletEditorialText({
  text,
  className,
  style,
}: Props) {
  return (
    <div className={`${styles.editorialText} ${className}`} style={style}>
      {parseDesignBookletEditorialText(text).map((block, blockIndex) =>
        block.kind === "paragraph" ? (
          <p key={blockIndex}>{block.text}</p>
        ) : (
          <ul
            key={blockIndex}
            className={styles.editorialBullets}
            data-booklet-bullet-list
          >
            {block.items.map((item, itemIndex) => (
              <li
                key={itemIndex}
                style={{
                  gridTemplateColumns: `${point(
                    DESIGN_BOOKLET_BULLET_GEOMETRY.markerWidth,
                  )} minmax(0, 1fr)`,
                  columnGap: point(DESIGN_BOOKLET_BULLET_GEOMETRY.markerGap),
                }}
              >
                <span aria-hidden="true">{DESIGN_BOOKLET_BULLET_GLYPH}</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
