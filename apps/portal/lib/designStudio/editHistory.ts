import {
  parseStudioAuthoringEdit,
  type StudioAuthoringEdit,
} from "./authoringView";
import { isStudioObject } from "./contracts";

export type StudioHistoryEntry = {
  edit: StudioAuthoringEdit;
  selection?: string;
};
export type StudioEditHistory = {
  generation: number;
  revision: number;
  past: StudioHistoryEntry[];
  future: StudioHistoryEntry[];
};
export type StudioHistoryChange = { selectionBefore?: string; group?: string };
const MAX_ENTRIES = 50;
const MAX_BYTES = 1024 * 1024;
const bytes = (value: unknown) =>
  new TextEncoder().encode(JSON.stringify(value)).length;

/** Optional navigation history never owns current work, receipts or permissions. */
export function boundedStudioHistory(
  history: StudioEditHistory,
): StudioEditHistory {
  // One full latest snapshot preserves the pre-existing in-memory Undo even for
  // a large supported edit. Persistence may omit that optional snapshot.
  while (
    history.past.length + history.future.length > MAX_ENTRIES ||
    (history.past.length + history.future.length > 1 &&
      bytes(history) > MAX_BYTES)
  ) {
    if (history.past.length) history.past.shift();
    else if (history.future.length) history.future.shift();
    else break;
  }
  return history;
}

export function readStudioHistory(
  raw: unknown,
  designId: string,
  generation: number,
  revision: number,
): StudioEditHistory | undefined {
  try {
    if (
      !isStudioObject(raw) ||
      Object.keys(raw).sort().join() !== "future,generation,past,revision" ||
      raw.generation !== generation ||
      raw.revision !== revision ||
      !Array.isArray(raw.past) ||
      !Array.isArray(raw.future) ||
      raw.past.length + raw.future.length > MAX_ENTRIES ||
      bytes(raw) > MAX_BYTES
    )
      return;
    const entries = (rows: unknown[]): StudioHistoryEntry[] =>
      rows.map((row) => {
        if (
          !isStudioObject(row) ||
          Object.keys(row).some((k) => !["edit", "selection"].includes(k)) ||
          (row.selection !== undefined &&
            (typeof row.selection !== "string" || row.selection.length > 240))
        )
          throw Error();
        const edit = parseStudioAuthoringEdit(row.edit);
        if (
          !edit.ok ||
          edit.value.designId !== designId ||
          edit.value.revision > revision
        )
          throw Error();
        if (
          row.selection &&
          !edit.value.spatial.pergolas.some((p) => p.id === row.selection) &&
          !edit.value.spatial.houseAssembly?.houseForms.some(
            (h) => h.id === row.selection,
          )
        )
          throw Error();
        return {
          edit: edit.value,
          ...(row.selection !== undefined
            ? { selection: row.selection as string }
            : {}),
        };
      });
    return {
      generation,
      revision,
      past: entries(raw.past),
      future: entries(raw.future),
    };
  } catch {
    return;
  }
}

export function recordStudioHistory(
  history: StudioEditHistory | undefined,
  previous: StudioAuthoringEdit,
  generation: number,
  revision: number,
  selection: string | undefined,
  coalesce: boolean,
) {
  return boundedStudioHistory({
    generation,
    revision,
    past:
      coalesce && history?.past.length
        ? history.past
        : [
            ...(history?.past ?? []),
            {
              edit: structuredClone(previous),
              ...(selection !== undefined ? { selection } : {}),
            },
          ],
    future: [],
  });
}
