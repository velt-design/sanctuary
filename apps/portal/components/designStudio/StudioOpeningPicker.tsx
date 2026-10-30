"use client";
import type { BlindOpening } from "@sp/geometry";
import css from "./StudioWebsite.module.css";
/** One control per actual opening, including multiple openings on one side. */
export default function StudioOpeningPicker({
  openings,
  selected,
  onSelect,
}: {
  openings: BlindOpening[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const points = openings.flatMap((o) => [o.start, o.end]),
    minX = Math.min(...points.map((p) => p.x)),
    maxX = Math.max(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y)),
    maxY = Math.max(...points.map((p) => p.y));
  const at = (p: { x: number; y: number }) => ({
    x: 42 + ((p.x - minX) / Math.max(1, maxX - minX)) * 156,
    y: 108 - ((p.y - minY) / Math.max(1, maxY - minY)) * 72,
  });
  return (
    <svg
      className={css.openingPicker}
      viewBox="0 0 240 150"
      role="group"
      aria-label="Select a side opening"
    >
      <rect
        x="42"
        y="36"
        width="156"
        height="72"
        fill="#f4f5f1"
        stroke="#a7afa2"
      />
      {openings.map((o) => {
        const a = at(o.start),
          b = at(o.end),
          active = selected === o.id;
        return (
          <g
            key={o.id}
            role="button"
            tabIndex={0}
            aria-label={`Choose ${o.label}`}
            aria-pressed={active}
            onClick={() => onSelect(o.id)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(o.id);
              }
            }}
            className={css.openingTarget}
          >
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="transparent"
              strokeWidth="18"
            />
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={active ? "#3e5b26" : "#777f71"}
              strokeWidth={active ? 4 : 2}
            />
            <text
              x={
                (a.x + b.x) / 2 +
                (o.side === "left" ? -10 : o.side === "right" ? 10 : 0)
              }
              y={(a.y + b.y) / 2 + (o.side === "front" ? 19 : o.side === "rear" ? -10 : 4)}
              textAnchor={
                o.side === "left"
                  ? "end"
                  : o.side === "right"
                    ? "start"
                    : "middle"
              }
              fill={active ? "#3e5b26" : "#4a5144"}
              fontSize="10"
            >
              {o.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
