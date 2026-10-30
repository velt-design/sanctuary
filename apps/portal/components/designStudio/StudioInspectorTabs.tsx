"use client";
import { useRef } from "react";
import css from "./StudioWebsite.module.css";
type Section = "Shape" | "Roof" | "Sides" | "Lighting";
const tabs = [
  { section: "Shape", label: "Design" },
  { section: "Lighting", label: "Lights" },
  { section: "Sides", label: "Sides" },
] as const;
/** Presentation navigation only; product, tool and authored state stay upstream. */
export default function StudioInspectorTabs({
  section,
  choose,
}: {
  section: Section;
  choose: (section: Section) => void;
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([]),
    active = section === "Roof" ? "Shape" : section;
  return (
    <nav
      className={css.tabs}
      role="tablist"
      aria-label="Pergola design choices"
    >
      {tabs.map((tab, i) => (
        <button
          ref={(node) => {
            buttons.current[i] = node;
          }}
          key={tab.section}
          role="tab"
          id={`studio-tab-${tab.section}`}
          aria-controls="studio-inspector-panel"
          aria-selected={active === tab.section}
          aria-pressed={active === tab.section}
          tabIndex={active === tab.section ? 0 : -1}
          onClick={() => choose(tab.section)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (i + 1) % tabs.length
                : event.key === "ArrowLeft"
                  ? (i + tabs.length - 1) % tabs.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : null;
            if (next !== null) {
              event.preventDefault();
              choose(tabs[next].section);
              buttons.current[next]?.focus();
            }
          }}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
