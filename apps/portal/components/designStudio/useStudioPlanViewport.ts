"use client";
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import type { PointerEvent, SVGProps } from "react";
import type { StudioDirectDrag } from "@/lib/designStudio/interaction/contracts";
import type { StudioSceneView } from "./studioHouseContext";
import {
  captureStudioHousePlanFrame,
  initialStudioPlanCamera,
  studioPlanPoint,
  studioPlanViewBox,
  studioPlanUnits,
  type StudioPlanCamera,
} from "./studioHousePlanFrame";
import {
  captureStudioPlanPointerMapping,
  studioPlanPointerPoint,
  type StudioPlanPointerMapping,
} from "./studioPlanPointer";
type Point = { x: number; y: number };
type Inputs = {
  view: StudioSceneView;
  points: ReadonlyArray<Point>;
  directFramePoints?: ReadonlyArray<Point>;
  cameraStorageKey?: string;
  persistentViewport: boolean;
  directDrag?: StudioDirectDrag;
  movementLocked: boolean;
  joinDraft: boolean;
  hasFootprint: boolean;
};
/** Plan DOM/camera owner. Capture is transient adapter state; the domain
 * controller alone owns pressed/dragging/waiting/commit authority. */
export function useStudioPlanViewport({
  view,
  points,
  directFramePoints,
  cameraStorageKey,
  persistentViewport,
  directDrag,
  movementLocked,
  joinDraft,
  hasFootprint,
}: Inputs) {
  const [legacyPlanFrame, setPlanFrame] = useState(() =>
    captureStudioHousePlanFrame(points.map(studioPlanPoint)),
  );
  const [planCamera, setPlanCamera] = useState<StudioPlanCamera | null>(() => {
    try {
      const v = JSON.parse(
        sessionStorage.getItem(`${cameraStorageKey}:plan`) ?? "null",
      );
      return cameraStorageKey &&
        v &&
        [v.x, v.y, v.units].every(Number.isFinite) &&
        v.units > 0
        ? {
            x: v.x,
            y: v.y,
            units: v.units,
            ...(v.viewport &&
            [v.viewport.width, v.viewport.height].every(
              (n: unknown) =>
                typeof n === "number" && Number.isFinite(n) && n > 0,
            )
              ? { viewport: v.viewport }
              : {}),
          }
        : null;
    } catch {
      return null;
    }
  });
  useLayoutEffect(() => {
    if (cameraStorageKey && planCamera)
      try {
        sessionStorage.setItem(
          `${cameraStorageKey}:plan`,
          JSON.stringify(planCamera),
        );
      } catch {}
  }, [cameraStorageKey, planCamera]);
  const svg = useRef<SVGSVGElement>(null);
  const directMapping = useRef<StudioPlanPointerMapping | null>(null);
  const touchPoints = useRef(new Map<number, Point>());
  const touchCamera = useRef<{
    ids: number[];
    start: Point;
    distance: number;
    centre: Point;
    camera: StudioPlanCamera;
  } | null>(null);
  const suppressTouchClick = useRef(false);
  function finishTouch(restore: boolean) {
    const gesture = touchCamera.current;
    if (gesture && restore) setPlanCamera(gesture.camera);
    touchCamera.current = null;
    // Ending a camera projection does not release its physical contacts.
    // Retain them until up/cancel so a replacement finger cannot grab a model
    // while another finger from that camera gesture is still on the surface.
    if (gesture) directDrag?.pan?.(false);
  }

  useLayoutEffect(() => {
    if (directMapping.current || (directDrag && directDrag.phase !== "idle")) {
      directDrag?.cancel();
      directMapping.current = null;
      svg.current?.setAttribute("data-gesture-phase", "idle");
    }
  }, [view, planCamera?.x, planCamera?.y, planCamera?.units]);
  const [svgSize, setSvgSize] = useState({ width: 1000, height: 700 });
  useEffect(() => {
    const node = svg.current;
    if (!node) return;
    const observer = new ResizeObserver(() =>
      setSvgSize({ width: node.clientWidth, height: node.clientHeight }),
    );
    observer.observe(node);
    setSvgSize({ width: node.clientWidth, height: node.clientHeight });
    return () => observer.disconnect();
  }, [view]);
  // A Split/rail resize invalidates the acquired screen basis just like an
  // explicit camera change. Never reinterpret its final-up in another viewport.
  useLayoutEffect(() => {
    if (directMapping.current || (directDrag && directDrag.phase !== "idle")) {
      directDrag?.cancel();
      directMapping.current = null;
      svg.current?.setAttribute("data-gesture-phase", "idle");
    }
    if (pan.current) {
      setPlanCamera(pan.current.camera);
      pan.current = null;
      directDrag?.pan?.(false);
    }
    finishTouch(true);
  }, [svgSize.width, svgSize.height]);
  useEffect(() => {
    if (persistentViewport) {
      if (!planCamera && svg.current && svgSize.width > 0 && svgSize.height > 0)
        setPlanCamera(
          initialStudioPlanCamera([...points, ...(directFramePoints ?? [])], {
            width: svg.current.clientWidth,
            height: svg.current.clientHeight,
          }),
        );
      else if (
        planCamera &&
        !planCamera.viewport &&
        svg.current &&
        svg.current.clientWidth > 0 &&
        svg.current.clientHeight > 0
      )
        setPlanCamera({
          ...planCamera,
          viewport: {
            width: svg.current.clientWidth,
            height: svg.current.clientHeight,
          },
        });
    } else if (directFramePoints)
      setPlanFrame(
        captureStudioHousePlanFrame(
          [...points, ...directFramePoints].map(studioPlanPoint),
          svgSize,
        ),
      );
  }, [directFramePoints, svgSize, persistentViewport, planCamera, points]);
  const planFrame =
    persistentViewport && planCamera
      ? studioPlanViewBox(planCamera, svgSize)
      : legacyPlanFrame;
  const zoomPlan = (factor: number) => {
    finishTouch(false);
    setPlanCamera((current) =>
      current
        ? {
            ...current,
            units: Math.max(
              0.1,
              Math.min(1000, studioPlanUnits(current, svgSize) * factor),
            ),
            viewport: svgSize,
          }
        : current,
    );
  };
  const grabTiming = useRef<number | null>(null);
  useEffect(() => {
    if (!persistentViewport || typeof PerformanceObserver === "undefined")
      return;
    const entries: { start: number; duration: number }[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        entries.push({ start: e.startTime, duration: e.duration });
      while (entries.length > 30) entries.shift();
      if (svg.current && grabTiming.current !== null)
        svg.current.setAttribute(
          "data-grab-long-tasks",
          JSON.stringify(
            entries.filter((e) => e.start + e.duration >= grabTiming.current!),
          ),
        );
    });
    try {
      observer.observe({ type: "longtask", buffered: false });
    } catch {}
    return () => observer.disconnect();
  }, [persistentViewport]);
  useLayoutEffect(() => {
    const node = svg.current;
    if (
      !hasFootprint ||
      !node ||
      grabTiming.current === null ||
      node.hasAttribute("data-grab-dom-ms")
    )
      return;
    node.setAttribute(
      "data-grab-dom-ms",
      String(performance.now() - grabTiming.current),
    );
  }, [hasFootprint]);
  const pan = useRef<{
    pointerId: number;
    client: { x: number; y: number };
    camera: StudioPlanCamera;
  } | null>(null);
  const suppressContext = useRef(false);
  useEffect(() => {
    const node = svg.current;
    if (!persistentViewport || !node) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      finishTouch(false);
      const rect = node.getBoundingClientRect();
      setPlanCamera((current) => {
        if (!current) return current;
        const currentUnits = studioPlanUnits(current, svgSize);
        const units = Math.max(
          0.1,
          Math.min(
            1000,
            currentUnits *
              Math.exp(Math.max(-100, Math.min(100, event.deltaY)) * 0.002),
          ),
        );
        const x = event.clientX - rect.left - rect.width / 2,
          y = event.clientY - rect.top - rect.height / 2;
        return {
          x: current.x + x * (currentUnits - units),
          y: current.y + y * (currentUnits - units),
          units,
          viewport: svgSize,
        };
      });
    };
    node.addEventListener("wheel", wheel, { passive: false });
    return () => node.removeEventListener("wheel", wheel);
  }, [persistentViewport, view, svgSize]);

  const frame = planFrame.split(" ").map(Number),
    unitsPerPixel = Math.max(
      frame[2] / Math.max(1, svgSize.width),
      frame[3] / Math.max(1, svgSize.height),
    );
  const mark = () =>
    svg.current?.setAttribute(
      "data-gesture-phase",
      directDrag?.phase ?? "idle",
    );
  function cancel() {
    directDrag?.cancel();
    directMapping.current = null;
    mark();
  }
  function pointer(event: PointerEvent<SVGSVGElement>) {
    const mapping = directMapping.current;
    return mapping
      ? {
          pointerId: event.pointerId,
          world: studioPlanPointerPoint(mapping, event.clientX, event.clientY),
          screen: { x: event.clientX, y: event.clientY },
          units: mapping.units,
        }
      : null;
  }
  function startDrag(e: PointerEvent<SVGElement>, id: string) {
    if (e.button !== 0) return;
    e.preventDefault();
    if (movementLocked || joinDraft || !directDrag) return;
    const node = svg.current,
      mapping = captureStudioPlanPointerMapping(node, unitsPerPixel);
    if (!node || !mapping) return;
    const at = performance.now();
    if (
      !directDrag.press(id, {
        pointerId: e.pointerId,
        world: studioPlanPointerPoint(mapping, e.clientX, e.clientY),
        screen: { x: e.clientX, y: e.clientY },
        units: mapping.units,
      })
    )
      return;
    directMapping.current = mapping;
    node.setPointerCapture(e.pointerId);
    mark();
    grabTiming.current = at;
    node.removeAttribute("data-grab-dom-ms");
    node.setAttribute("data-grab-start", String(at));
    node.setAttribute("data-grab-handler-ms", String(performance.now() - at));
  }
  const handlers: SVGProps<SVGSVGElement> = {
    onPointerDownCapture: (e) => {
      if (e.pointerType === "touch" && persistentViewport && planCamera) {
        if (!touchPoints.current.size) suppressTouchClick.current = false;
        touchPoints.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (touchPoints.current.size >= 2) {
          e.preventDefault();
          e.stopPropagation();
          if (!touchCamera.current) {
            cancel();
            directDrag?.pan?.(true);
            suppressTouchClick.current = true;
            const entries = [...touchPoints.current.entries()].slice(0, 2),
              a = entries[0][1],
              b = entries[1][1],
              rect = e.currentTarget.getBoundingClientRect();
            touchCamera.current = {
              ids: entries.map(([id]) => id),
              start: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
              distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
              centre: {
                x: rect.left + (rect.width || svgSize.width) / 2,
                y: rect.top + (rect.height || svgSize.height) / 2,
              },
              camera: {
                ...planCamera,
                units: unitsPerPixel,
                viewport: svgSize,
              },
            };
            for (const [id] of entries) e.currentTarget.setPointerCapture(id);
          }
        }
        return;
      }
      suppressTouchClick.current = false;
      finishTouch(false);
      if (e.button !== 2 || !persistentViewport || !planCamera) return;
      e.preventDefault();
      e.stopPropagation();
      suppressContext.current = true;
      cancel();
      directDrag?.pan?.(true);
      pan.current = {
        pointerId: e.pointerId,
        client: { x: e.clientX, y: e.clientY },
        camera: { ...planCamera, units: unitsPerPixel, viewport: svgSize },
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onContextMenu: (e) => {
      if (suppressContext.current) {
        e.preventDefault();
        suppressContext.current = false;
      }
    },
    onClickCapture: (e) => {
      if (suppressTouchClick.current && e.detail !== 0) {
        e.preventDefault();
        e.stopPropagation();
        suppressTouchClick.current = false;
      }
    },
    onDragStart: (e) => e.preventDefault(),
    onPointerMove: (e) => {
      if (touchPoints.current.has(e.pointerId))
        touchPoints.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const gesture = touchCamera.current;
      if (gesture) {
        const [a, b] = gesture.ids.map((id) => touchPoints.current.get(id));
        if (a && b) {
          const units = Math.max(
              0.1,
              Math.min(
                1000,
                (gesture.camera.units * gesture.distance) /
                  Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
              ),
            ),
            x = (a.x + b.x) / 2,
            y = (a.y + b.y) / 2;
          setPlanCamera({
            ...gesture.camera,
            units,
            x:
              gesture.camera.x +
              (gesture.start.x - gesture.centre.x) * gesture.camera.units -
              (x - gesture.centre.x) * units,
            y:
              gesture.camera.y +
              (gesture.start.y - gesture.centre.y) * gesture.camera.units -
              (y - gesture.centre.y) * units,
          });
        }
        return;
      }
      const p = pan.current;
      if (p) {
        if (p.pointerId !== e.pointerId) return;
        setPlanCamera({
          ...p.camera,
          x: p.camera.x - (e.clientX - p.client.x) * p.camera.units,
          y: p.camera.y - (e.clientY - p.client.y) * p.camera.units,
        });
        return;
      }
      if (directDrag?.pointerId === e.pointerId) {
        const value = pointer(e);
        if (value) directDrag.move(value);
        mark();
      }
    },
    onPointerUp: (e) => {
      touchPoints.current.delete(e.pointerId);
      if (touchCamera.current?.ids.includes(e.pointerId)) {
        finishTouch(false);
        return;
      }
      if (pan.current) {
        if (pan.current.pointerId === e.pointerId) {
          pan.current = null;
          directDrag?.pan?.(false);
        }
        return;
      }
      if (directMapping.current && directDrag?.pointerId === e.pointerId) {
        const value = pointer(e);
        if (value) directDrag.release(value);
        else directDrag.cancel();
        directMapping.current = null;
        mark();
      }
    },
    onPointerCancel: (e) => {
      touchPoints.current.delete(e.pointerId);
      if (touchCamera.current?.ids.includes(e.pointerId)) {
        finishTouch(true);
        return;
      }
      if (pan.current) {
        if (pan.current.pointerId === e.pointerId) {
          setPlanCamera(pan.current.camera);
          pan.current = null;
          directDrag?.pan?.(false);
        }
        return;
      }
      if (directDrag?.pointerId === e.pointerId) cancel();
    },
    onLostPointerCapture: (e) => {
      if (touchCamera.current?.ids.includes(e.pointerId)) {
        finishTouch(true);
        return;
      }
      if (pan.current) {
        setPlanCamera(pan.current.camera);
        pan.current = null;
        directDrag?.pan?.(false);
      } else if (directMapping.current && directDrag?.pointerId === e.pointerId)
        cancel();
    },
  };
  useEffect(() => {
    // A retired capture or hidden Plan can receive the final contact release
    // outside the SVG. This only drains camera input, never authors a release.
    const contactEnd = (event: globalThis.PointerEvent) => {
      if (!touchPoints.current.delete(event.pointerId)) return;
      if (touchCamera.current?.ids.includes(event.pointerId))
        finishTouch(event.type === "pointercancel");
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (touchCamera.current) {
        event.preventDefault();
        finishTouch(true);
        return;
      }
      if (pan.current) {
        event.preventDefault();
        setPlanCamera(pan.current.camera);
        pan.current = null;
        directDrag?.pan?.(false);
      } else if (directDrag && directDrag.phase !== "idle") {
        event.preventDefault();
        cancel();
      }
    };
    window.addEventListener("pointerup", contactEnd);
    window.addEventListener("pointercancel", contactEnd);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerup", contactEnd);
      window.removeEventListener("pointercancel", contactEnd);
      window.removeEventListener("keydown", escape);
    };
  }, [directDrag]);
  useEffect(() => {
    cancel();
    finishTouch(true);
    if (pan.current) {
      setPlanCamera(pan.current.camera);
      pan.current = null;
      directDrag?.pan?.(false);
    }
  }, [view]);
  useEffect(() => () => directDrag?.cancel(), [directDrag]);
  return {
    svg,
    planFrame,
    unitsPerPixel,
    handlers,
    startDrag,
    zoom: (step: number) => zoomPlan(Math.pow(0.8, step)),
    fitToFrame: (framePoints: ReadonlyArray<Point>) => {
      finishTouch(false);
      return persistentViewport
        ? setPlanCamera(initialStudioPlanCamera(framePoints, svgSize))
        : setPlanFrame(
            captureStudioHousePlanFrame(
              framePoints.map(studioPlanPoint),
              svgSize,
            ),
          );
    },
  };
}
