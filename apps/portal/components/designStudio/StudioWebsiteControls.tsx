"use client";
import { useEffect, type ReactNode } from "react";
import { usePreviewBlinds, useLighting } from "@sp/configurator/react/controls";
import Sides from "./StudioWebsiteSideControls";
import Lighting from "./StudioWebsiteLightingControls";
import Shape, { StudioWebsiteShapeDetails } from "./StudioWebsiteShapeControls";
import Roof from "./StudioWebsiteRoofControls";
import StudioInspectorTabs from "./StudioInspectorTabs";
import type { StudioWebsiteDesign } from "@/lib/designStudio/websiteDesign";
import css from "./StudioWebsite.module.css";
export default function StudioWebsiteControls({
  value,
  onChange,
  section,
  choose,
  bookmarkKey,
  onModelPreview,
  onPlanPreview,
  onDesignRepair,
  connectionControls,
}: {
  onModelPreview: () => void;
  onPlanPreview?: () => void;
  onDesignRepair?: () => void;
  connectionControls?: ReactNode;
  bookmarkKey: string;
  value: StudioWebsiteDesign;
  onChange: (v: StudioWebsiteDesign) => void;
  section: "Shape" | "Roof" | "Sides" | "Lighting";
  choose: (s: "Shape" | "Roof" | "Sides" | "Lighting") => void;
}) {
  const blinds = usePreviewBlinds()!,
    light = useLighting()!,
    design = section === "Shape" || section === "Roof";
  useEffect(() => {
    blinds.setEditing(section === "Sides");
  }, [section, blinds.setEditing]);
  const tab = (next: typeof section) => {
    choose(next);
    if (next === "Lighting") light.open();
    else light.close();
  };
  const preview = (night: boolean) => {
    light.setView("3D");
    light.setNight(night);
    onModelPreview();
  };
  return (
    <aside
      className={`${css.rail} ${css.cadControls}`}
      aria-label="Pergola design choices"
    >
      <StudioInspectorTabs section={section} choose={tab} />
      <div
        className={css.inspectorBody}
        id="studio-inspector-panel"
        role="tabpanel"
        aria-labelledby={`studio-tab-${design ? "Shape" : section}`}
      >
        {design && (
          <>
            <Shape value={value} onChange={onChange} connectionControls={connectionControls} />
            <Roof value={value} onChange={onChange} compact />
            <StudioWebsiteShapeDetails value={value} onChange={onChange} />
          </>
        )}
        {section === "Sides" && (
          <Sides
            value={value}
            onChange={onChange}
            bookmarkKey={bookmarkKey}
            compact
          />
        )}
        {section === "Lighting" && (
          <>
            <div
              className={css.previewSwitch}
              role="group"
              aria-label="Lighting preview"
            >
              <button
                aria-pressed={!light.night}
                onClick={() => preview(false)}
              >
                Day
              </button>
              <button aria-pressed={light.night} onClick={() => preview(true)}>
                Night
              </button>
            </div>
            <Lighting
              compact
              onChoosePlan={onPlanPreview}
              onDesign={() => {
                tab("Shape");
                onDesignRepair?.();
              }}
            />
          </>
        )}
      </div>
    </aside>
  );
}
