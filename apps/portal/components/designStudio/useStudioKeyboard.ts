"use client";
import { useEffect, useRef, type KeyboardEvent } from "react";
import type { StudioSceneCopy } from "@/lib/designStudio/studioSceneCommands";

export type StudioShortcut =
  | { kind: "copy" }
  | { kind: "paste"; copy: StudioSceneCopy }
  | { kind: "undo" }
  | { kind: "redo" }
  | { kind: "delete" }
  | { kind: "nudge"; dx: number; dy: number; group: string };

/** DOM input ownership only. All changes still cross the current session and
 * canonical object commands supplied by Workspace. Clipboard is local/scope-only. */
export function useStudioKeyboard({
  lifetime,
  selected,
  enabled,
  perform,
  endGroup,
}: {
  lifetime: string;
  selected: string;
  enabled: boolean;
  perform: (action: StudioShortcut) => StudioSceneCopy | void;
  endGroup: () => void;
}) {
  const copy = useRef<{ lifetime: string; value: StudioSceneCopy } | null>(
    null,
  );
  const held = useRef<{
    lifetime: string;
    selected: string;
    group: string;
    keys: Set<string>;
  } | null>(null);
  const end = () => {
    held.current = null;
    endGroup();
  };
  useEffect(() => {
    copy.current = null;
    end();
  }, [lifetime]);
  useEffect(() => {
    end();
  }, [selected]);
  useEffect(() => {
    if (!enabled) end();
  }, [enabled]);
  useEffect(() => {
    const up = (event: globalThis.KeyboardEvent) => {
      held.current?.keys.delete(event.key);
      if (!held.current?.keys.size) end();
    };
    const blur = () => end();
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      end();
    };
  }, []);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    if (
      !enabled ||
      event.defaultPrevented ||
      event.nativeEvent.isComposing ||
      event.key === "Process" ||
      event.altKey ||
      !target ||
      target.closest(
        'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="menu"],[role^="menuitem"],[role="combobox"],[role="spinbutton"]',
      ) ||
      window.getSelection()?.isCollapsed === false ||
      event.currentTarget.querySelector(
        'details[open] > summary[aria-label="Design tools"]',
      )
    )
      return;
    const primary =
        (event.ctrlKey || event.metaKey) && !(event.ctrlKey && event.metaKey),
      key = event.key.toLowerCase();
    if (primary && (!event.shiftKey || key === "z")) {
      const kind =
        key === "c"
          ? "copy"
          : key === "v"
            ? "paste"
            : key === "z"
              ? event.shiftKey
                ? "redo"
                : "undo"
              : key === "y"
                ? "redo"
                : null;
      if (!kind) return;
      event.preventDefault();
      if (event.repeat) return;
      end();
      if (kind === "copy") {
        const value = perform({ kind });
        if (value) copy.current = { lifetime, value };
      } else if (kind === "paste") {
        if (copy.current?.lifetime === lifetime)
          perform({ kind, copy: copy.current.value });
      } else perform({ kind });
      return;
    }
    if (event.ctrlKey || event.metaKey) return;
    if (event.key === "Delete") {
      event.preventDefault();
      if (!event.repeat) {
        end();
        perform({ kind: "delete" });
      }
      return;
    }
    if (
      target.closest(
        'a,summary,[role="tab"],[role="tablist"],[role="slider"],[role="listbox"],[role="tree"],[role="grid"]',
      )
    )
      return;
    const delta = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, 1],
      ArrowDown: [0, -1],
    }[event.key];
    if (!delta) {
      end();
      return;
    }
    event.preventDefault();
    if (
      !held.current ||
      held.current.lifetime !== lifetime ||
      held.current.selected !== selected
    )
      held.current = {
        lifetime,
        selected,
        group: crypto.randomUUID(),
        keys: new Set(),
      };
    held.current.keys.add(event.key);
    const step = event.shiftKey ? 100 : 10;
    perform({
      kind: "nudge",
      dx: delta[0] * step,
      dy: delta[1] * step,
      group: held.current.group,
    });
  };
  return { onKeyDown, end };
}
