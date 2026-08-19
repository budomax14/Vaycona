import React, { useMemo, useRef, useState } from "react";
import { contentToScreen } from "../viewport";
import {
  getCropLayoutInfo,
  itemLocalToVisibleFraction,
  visibleFractionToItemLocal,
  screenPointToItemLocal,
} from "../grabIt/grabItCoordinates";

// Grab It's on-canvas DOM overlay — modeled directly on FadeOverlay.jsx's
// "DOM sibling positioned via contentToScreen + CSS rotate, so it naturally
// sits above the Stage and intercepts pointer events" trick, so it stays
// correctly aligned with the source image through zoom/pan/rotation without
// drifting (spec's "don't introduce DOM overlays that drift away from the
// Konva canvas" requirement).
//
// Unlike Fade/Crop, nothing on the source item is mutated while this is
// mounted (Grab It never drags a handle) — hover/click purely READ the
// current pointer position and detected regions to decide what to
// highlight/extract.
export default function GrabItOverlay({ item, viewport, scale, regions, detectionMeta, hoveredRegionId, onHoverChange, showAllRegions, isDetecting, onPick }) {
  const wrapperRef = useRef(null);
  const [poppingId, setPoppingId] = useState(null);

  const width = Math.max(1, item.width || 100);
  const height = Math.max(1, item.height || 100);
  const naturalWidth = detectionMeta?.naturalWidth || item.naturalWidth || width;
  const naturalHeight = detectionMeta?.naturalHeight || item.naturalHeight || height;

  const { layout } = useMemo(
    () => getCropLayoutInfo(item.crop, naturalWidth, naturalHeight, width, height),
    [item.crop, naturalWidth, naturalHeight, width, height]
  );

  function regionAtPointerEvent(event) {
    if (!wrapperRef.current || regions.length === 0) return null;
    const rect = wrapperRef.current.getBoundingClientRect();
    const centerClient = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const local = screenPointToItemLocal(event, item, scale, centerClient);
    const { fx, fy, inside } = itemLocalToVisibleFraction(local.x, local.y, layout, width, height);
    if (!inside) return null;

    for (const region of regions) {
      if (fx < region.x || fx > region.x + region.width || fy < region.y || fy > region.y + region.height) continue;
      if (!region.mask || !detectionMeta?.processingWidth || !detectionMeta?.processingHeight) return region;
      const procX = Math.floor(fx * detectionMeta.processingWidth);
      const procY = Math.floor(fy * detectionMeta.processingHeight);
      const localX = procX - region.maskOffsetXPx;
      const localY = procY - region.maskOffsetYPx;
      if (localX < 0 || localY < 0 || localX >= region.mask.width || localY >= region.mask.height) continue;
      // Real mask lookup (not just the bbox) — a click inside a donut's
      // hole, or between two nearby-but-separate designs' bboxes, correctly
      // misses rather than grabbing the wrong/whole thing.
      if (region.mask.data[localY * region.mask.width + localX] === 1) return region;
    }
    return null;
  }

  function handlePointerMove(event) {
    const region = regionAtPointerEvent(event);
    onHoverChange(region ? region.id : null);
  }

  function handleClick(event) {
    const region = regionAtPointerEvent(event);
    if (!region) return;
    setPoppingId(region.id);
    window.setTimeout(() => {
      setPoppingId(null);
      onPick(region);
    }, 110);
  }

  function outlinePoints(region) {
    const fractionPoints =
      region.outline && region.outline.length >= 3
        ? region.outline
        : [
            [region.x, region.y],
            [region.x + region.width, region.y],
            [region.x + region.width, region.y + region.height],
            [region.x, region.y + region.height],
          ];
    return fractionPoints
      .map(([fx, fy]) => visibleFractionToItemLocal(fx, fy, layout, width, height))
      .map((p) => `${p.x},${p.y}`)
      .join(" ");
  }

  const topLeft = contentToScreen({ x: item.x, y: item.y }, viewport);
  const boxScreenWidth = width * viewport.scale;
  const boxScreenHeight = height * viewport.scale;
  const hoveredRegion = regions.find((r) => r.id === hoveredRegionId) || null;

  return (
    <div
      ref={wrapperRef}
      data-grab-it-toolbar-safe
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onHoverChange(null)}
      onClick={handleClick}
      style={{
        position: "absolute",
        left: topLeft.x,
        top: topLeft.y,
        width: boxScreenWidth,
        height: boxScreenHeight,
        transform: `rotate(${item.rotation || 0}deg)`,
        transformOrigin: "0 0",
        zIndex: 25,
        cursor: hoveredRegion ? "pointer" : "default",
        background: "rgba(15, 23, 42, 0.05)",
        touchAction: "none",
      }}
    >
      <svg width={boxScreenWidth} height={boxScreenHeight} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
        <g transform={`scale(${boxScreenWidth / width} ${boxScreenHeight / height})`}>
          {showAllRegions &&
            regions.map((region) => (
              <polygon key={region.id} points={outlinePoints(region)} fill="none" stroke="rgba(217,119,6,0.35)" strokeWidth={1.5 * (width / boxScreenWidth)} />
            ))}
          {hoveredRegion &&
            (() => {
              const center = visibleFractionToItemLocal(hoveredRegion.x + hoveredRegion.width / 2, hoveredRegion.y + hoveredRegion.height / 2, layout, width, height);
              return (
                <polygon
                  points={outlinePoints(hoveredRegion)}
                  fill="rgba(217,119,6,0.16)"
                  stroke="#d97706"
                  strokeWidth={2 * (width / boxScreenWidth)}
                  style={{
                    transformOrigin: `${center.x}px ${center.y}px`,
                    transform: poppingId === hoveredRegion.id ? "scale(1.05)" : "scale(1)",
                    transition: "transform 110ms ease-out",
                  }}
                />
              );
            })()}
        </g>
      </svg>

      {isDetecting && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <span
            style={{
              background: "#ffffff",
              borderRadius: 8,
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 500,
              color: "#6b7280",
              boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
            }}
          >
            Analyzing…
          </span>
        </div>
      )}
    </div>
  );
}
