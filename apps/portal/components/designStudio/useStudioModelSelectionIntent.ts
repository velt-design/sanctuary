"use client";
import { useLayoutEffect, useRef, type PointerEvent } from "react";

type Press = {
  pointerId: number;
  x: number;
  y: number;
  phase: "pressed" | "released" | "cancelled";
  click: boolean;
};
/** Studio-only intent at the native event boundary, before R3F dispatches
 * House, member callbacks or accessory fall-through. Observe camera input;
 * suppress only its eventual click, never OrbitControls' pointer events. */
export function useStudioModelSelectionIntent(active: boolean) {
  const press = useRef<Press | null>(null);
  useLayoutEffect(() => {
    press.current = null;
    return () => {
      press.current = null;
    };
  }, [active]);
  const sample = (event: PointerEvent<HTMLDivElement>) => {
    const current = press.current;
    if (current?.pointerId !== event.pointerId || current.phase !== "pressed")
      return;
    // Same rounded CSS-pixel boundary as existing R3F accessory delta<6.
    // Peak displacement is sticky, so returning to the start is still a drag.
    if (
      Math.round(
        Math.hypot(event.clientX - current.x, event.clientY - current.y),
      ) >= 6
    )
      current.click = false;
  };
  const cancel = (event: PointerEvent<HTMLDivElement>) => {
    if (press.current?.pointerId === event.pointerId) {
      press.current.phase = "cancelled";
      press.current.click = false;
    }
  };
  return {
    onPointerDownCapture(event: PointerEvent<HTMLDivElement>) {
      press.current =
        active && event.button === 0 && event.isPrimary !== false
          ? {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              phase: "pressed",
              click: true,
            }
          : null;
    },
    onPointerMoveCapture: sample,
    onPointerUpCapture(event: PointerEvent<HTMLDivElement>) {
      sample(event);
      if (
        press.current?.pointerId === event.pointerId &&
        press.current.phase === "pressed"
      )
        press.current.phase = "released";
    },
    onPointerCancelCapture: cancel,
    onLostPointerCaptureCapture(event: PointerEvent<HTMLDivElement>) {
      // Normal implicit capture loss after up precedes click; retain its verdict.
      if (press.current?.phase === "pressed") cancel(event);
    },
    onWheelCapture() {
      if (press.current?.phase === "pressed") press.current.click = false;
    },
    onClickCapture(event: React.MouseEvent<HTMLDivElement>) {
      const current = press.current;
      press.current = null;
      if (
        !active ||
        event.button !== 0 ||
        (event.detail !== 0 &&
          current &&
          (!current.click || current.phase !== "released"))
      )
        event.stopPropagation();
    },
  };
}
