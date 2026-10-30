"use client";
import type { PreviewGeometryOptions } from "../../geometry";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { representativeBlindOpenings, type BlindOpening } from "@sp/geometry";
import type { solvePergolaPreview } from "../../geometry";
import type { SimpleCoverInput } from "../../geometry";
import type { PreviewRoofChoices } from "../../geometry";
import type { PreviewBlind } from "../../website";
import { previewBlindOpenings } from "../../geometry";
import { defaultSidePanel, type SidePanel } from "../../website";
import { defaultBlind } from "../../website";
type BlindWorkspace = {
  openings: BlindOpening[];
  blinds: PreviewBlind[];
  panels: SidePanel[];
  setPanel: (panel: SidePanel) => void;
  setKind: (kind: "open" | "blind" | SidePanel["kind"]) => void;
  selected: string;
  select: (id: string) => void;
  editing: boolean;
  setEditing: (value: boolean) => void;
  update: (blinds: PreviewBlind[]) => void;
};
const Context = createContext<BlindWorkspace | null>(null);
export const usePreviewBlinds = () => useContext(Context);
export default function PreviewBlindProvider({
  input,
  roof,
  geometryOptions,
  preparedGeometry,
  onChange,
  children,
  readOnly = false,
  onChooseSides,
}: {
  onChooseSides?: () => void;
  readOnly?: boolean;
  input: SimpleCoverInput;
  roof: PreviewRoofChoices;
  geometryOptions?: PreviewGeometryOptions;
  /** Same current input/roof/options artifact; null means unavailable. */
  preparedGeometry?: ReturnType<typeof solvePergolaPreview>["geometry"] | null;
  onChange: (roof: PreviewRoofChoices) => void;
  children: ReactNode;
}) {
  const openings = useMemo(
    () => preparedGeometry === undefined
      ? previewBlindOpenings(input, roof, geometryOptions)
      : preparedGeometry
        ? representativeBlindOpenings(preparedGeometry.assembly, geometryOptions)
        : [],
    [input, roof, geometryOptions, preparedGeometry],
  );
  const [selected, setSelected] = useState(""),
    [editing, setEditing] = useState(false);
  const current =
    editing && openings.some((o) => o.id === selected) ? selected : "";
  const value = useMemo<BlindWorkspace>(
    () => ({
      openings,
      blinds: roof.blinds ?? [],
      panels: roof.sidePanels ?? [],
      selected: current,
      setPanel: (panel) =>
        current &&
        onChange({
          ...roof,
          sidePanels: [
            ...(roof.sidePanels ?? []).filter((p) => p.opening !== current),
            panel,
          ],
        }),
      setKind: (kind) =>
        current &&
        onChange({
          ...roof,
          blinds: [
            ...(roof.blinds ?? []).filter((b) => b.opening !== current),
            ...(kind === "blind" ? [defaultBlind(current)] : []),
          ],
          sidePanels: [
            ...(roof.sidePanels ?? []).filter((p) => p.opening !== current),
            ...(["acrylic", "timber", "aluminium"].includes(kind)
              ? [defaultSidePanel(current, kind as SidePanel["kind"])]
              : []),
          ],
        }),
      select: (id) => {
        if (readOnly) return;
        setSelected(id);
        setEditing(true);
        onChooseSides?.();
      },
      editing,
      setEditing,
      update: (blinds) => onChange({ ...roof, blinds }),
    }),
    [openings, roof, current, editing, readOnly, onChange, onChooseSides],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
