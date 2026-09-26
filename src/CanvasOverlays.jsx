import React from "react";
import GuideLine from "./GuideLine";
import { contentToScreen } from "./viewport";
import {
  squareGridLines,
  dotGridPoints,
  marginRect,
  safeAreaRect,
  bleedRect,
  columnRects,
  rowRects,
  columnEdges,
  rowEdges,
  baselinePositions,
} from "./precisionOverlayGeometry";
import { formatMeasurement } from "./measurement";

// Phase 10 — every editor-only canvas overlay (guides, grids, margins,
// safe area, bleed preview, layout grid, baseline grid, smart-alignment
// lines, equal-spacing indicators, distance labels, marquee) lives in this
// one component so App.jsx's render tree stays uncluttered and so there is
// exactly one place that reads precisionOverlayGeometry.js's shared
// geometry helpers for DRAWING (snapping.js reads the same helpers
// separately for SNAP TARGETS — see that file's header). None of this ever
// renders inside the exported Stage (see offscreenRenderer.jsx) — export
// fidelity is guaranteed structurally, not by a runtime flag here.
// Print Layout guides for one panel of a folded product (see
// print/printProducts.js panelEdges): `edges` says which of the panel's
// edges is a fold vs the sheet's outer edge, so bleed only extends past
// outer edges and the fold line lands on the right side. Editor-only like
// everything else here.
function renderPrintGuides({ edges, safeInsetPx, bleedPx, show }, pageWidth, pageHeight) {
  const shapes = [];
  const ext = (edge) => (edges[edge] === "outer" ? bleedPx : 0);
  if (show.bleed) {
    shapes.push(
      <rect key="pg-bleed" x={-ext("left")} y={-ext("top")} width={pageWidth + ext("left") + ext("right")} height={pageHeight + ext("top") + ext("bottom")} className="bleed-rect" />
    );
  }
  if (show.trim) {
    shapes.push(<rect key="pg-trim" x={0} y={0} width={pageWidth} height={pageHeight} className="print-trim-rect" />);
    const tick = 14;
    const gap = bleedPx + 4;
    [
      [0, 0, -1, -1],
      [pageWidth, 0, 1, -1],
      [0, pageHeight, -1, 1],
      [pageWidth, pageHeight, 1, 1],
    ].forEach(([x, y, dx, dy], i) => {
      shapes.push(<line key={`pg-th${i}`} x1={x + dx * gap} y1={y} x2={x + dx * (gap + tick)} y2={y} className="print-trim-rect" />);
      shapes.push(<line key={`pg-tv${i}`} x1={x} y1={y + dy * gap} x2={x} y2={y + dy * (gap + tick)} className="print-trim-rect" />);
    });
  }
  if (show.safe) {
    shapes.push(
      <rect key="pg-safe" x={safeInsetPx} y={safeInsetPx} width={Math.max(0, pageWidth - safeInsetPx * 2)} height={Math.max(0, pageHeight - safeInsetPx * 2)} className="safe-area-rect" />
    );
  }
  if (show.fold) {
    const foldLines = {
      left: [0, 0, 0, pageHeight],
      right: [pageWidth, 0, pageWidth, pageHeight],
      top: [0, 0, pageWidth, 0],
      bottom: [0, pageHeight, pageWidth, pageHeight],
    };
    Object.entries(edges)
      .filter(([, kind]) => kind === "fold")
      .forEach(([edge]) => {
        const [x1, y1, x2, y2] = foldLines[edge];
        shapes.push(<line key={`pg-fold-${edge}`} x1={x1} y1={y1} x2={x2} y2={y2} className="print-fold-line" />);
      });
  }
  return shapes;
}

export default function CanvasOverlays({
  pageWidth,
  pageHeight,
  viewport,
  guides,
  selectedGuideId,
  onGuideDragStart,
  onGuideDelete,
  onGuideSelect,
  marquee,
  grid,
  margins,
  safeArea,
  bleed,
  layoutGrid,
  baselineGrid,
  alignmentLines,
  equalSpacing,
  distanceLabels,
  unit = "px",
  printGuides = null,
}) {
  const topLeft = contentToScreen({ x: 0, y: 0 }, viewport);
  const bottomRight = contentToScreen({ x: pageWidth, y: pageHeight }, viewport);

  const gridLines = [];
  if (grid?.visible) {
    if (grid.type === "dot") {
      dotGridPoints(grid, pageWidth, pageHeight).forEach((p, i) => {
        gridLines.push(<circle key={`gd${i}`} cx={p.x} cy={p.y} r={grid.dotSize} style={{ fill: grid.color, opacity: grid.opacity }} />);
      });
    } else {
      const { vertical, horizontal } = squareGridLines(grid, pageWidth, pageHeight);
      vertical.forEach((x, i) => {
        const isMajor = grid.majorInterval > 0 && i % grid.majorInterval === 0;
        gridLines.push(
          <line key={`gx${i}`} x1={x} y1={0} x2={x} y2={pageHeight} className="grid-line" style={{ stroke: grid.color, opacity: isMajor ? grid.opacity : grid.opacity * 0.5 }} />
        );
      });
      horizontal.forEach((y, i) => {
        const isMajor = grid.majorInterval > 0 && i % grid.majorInterval === 0;
        gridLines.push(
          <line key={`gy${i}`} x1={0} y1={y} x2={pageWidth} y2={y} className="grid-line" style={{ stroke: grid.color, opacity: isMajor ? grid.opacity : grid.opacity * 0.5 }} />
        );
      });
    }
  }

  const layoutGridShapes = [];
  if (layoutGrid?.visible) {
    columnRects(layoutGrid, pageWidth, pageHeight).forEach((r, i) => layoutGridShapes.push(<rect key={`col${i}`} x={r.x} y={r.y} width={r.width} height={r.height} style={{ fill: layoutGrid.color, opacity: 0.06 }} />));
    columnEdges(layoutGrid, pageWidth).forEach((x, i) => layoutGridShapes.push(<line key={`ce${i}`} x1={x} y1={layoutGrid.marginTop} x2={x} y2={pageHeight - layoutGrid.marginBottom} className="layout-grid-line" style={{ stroke: layoutGrid.color }} />));
    rowRects(layoutGrid, pageWidth, pageHeight).forEach((r, i) => layoutGridShapes.push(<rect key={`row${i}`} x={r.x} y={r.y} width={r.width} height={r.height} style={{ fill: layoutGrid.color, opacity: 0.06 }} />));
    rowEdges(layoutGrid, pageHeight).forEach((y, i) => layoutGridShapes.push(<line key={`re${i}`} x1={layoutGrid.marginLeft} y1={y} x2={pageWidth - layoutGrid.marginRight} y2={y} className="layout-grid-line" style={{ stroke: layoutGrid.color }} />));
  }

  const baselineLines = baselineGrid?.visible
    ? baselinePositions(baselineGrid, pageHeight).map((y, i) => (
        <line key={`bl${i}`} x1={0} y1={y} x2={pageWidth} y2={y} className="baseline-grid-line" style={{ stroke: baselineGrid.color, opacity: baselineGrid.opacity }} />
      ))
    : [];

  const marginBox = margins?.visible ? marginRect(margins, pageWidth, pageHeight) : null;
  const safeBox = safeArea?.visible ? safeAreaRect(safeArea, pageWidth, pageHeight) : null;
  const bleedBox = bleed?.visible ? bleedRect(bleed, pageWidth, pageHeight) : null;

  const printGuideShapes = printGuides ? renderPrintGuides(printGuides, pageWidth, pageHeight) : null;

  const marqueeScreen = marquee ? contentToScreen({ x: marquee.x, y: marquee.y }, viewport) : null;

  function equalSpacingMarker(axis, info) {
    if (!info) return null;
    const label = `${formatMeasurement(info.gap, unit)}`;
    if (axis === "horizontal") {
      // Gap is along X — draw a small horizontal double-tick under a label,
      // centered vertically on the page for visibility regardless of the
      // dragged object's own Y.
      const y = pageHeight / 2;
      return (
        <g key="eq-h">
          <rect x={info.pos - 16} y={y - 9} width={32} height={16} rx={3} className="distance-label-bg" />
          <text x={info.pos} y={y + 3} textAnchor="middle" className="distance-label-text">{label}</text>
        </g>
      );
    }
    const x = pageWidth / 2;
    return (
      <g key="eq-v">
        <rect x={x - 16} y={info.pos - 8} width={32} height={16} rx={3} className="distance-label-bg" />
        <text x={x} y={info.pos + 4} textAnchor="middle" className="distance-label-text">{label}</text>
      </g>
    );
  }

  return (
    <div className="canvas-overlay">
      <svg
        className="overlay-svg"
        style={{
          left: topLeft.x,
          top: topLeft.y,
          width: bottomRight.x - topLeft.x,
          height: bottomRight.y - topLeft.y,
          overflow: "visible",
        }}
        viewBox={`0 0 ${pageWidth} ${pageHeight}`}
        preserveAspectRatio="none"
      >
        {bleedBox && <rect x={bleedBox.x} y={bleedBox.y} width={bleedBox.width} height={bleedBox.height} className="bleed-rect" />}
        {gridLines}
        {layoutGridShapes}
        {baselineLines}
        {marginBox && <rect x={marginBox.x} y={marginBox.y} width={marginBox.width} height={marginBox.height} className="margin-rect" />}
        {safeBox && <rect x={safeBox.x} y={safeBox.y} width={safeBox.width} height={safeBox.height} className="safe-area-rect" />}
        {printGuideShapes}
        {alignmentLines.vertical.map((x) => (
          <line key={`av${x}`} x1={x} y1={-50} x2={x} y2={pageHeight + 50} className={`alignment-line ${x === pageWidth / 2 ? "page-center-line" : ""}`} />
        ))}
        {alignmentLines.horizontal.map((y) => (
          <line key={`ah${y}`} x1={-50} y1={y} x2={pageWidth + 50} y2={y} className={`alignment-line ${y === pageHeight / 2 ? "page-center-line" : ""}`} />
        ))}
        {equalSpacingMarker("horizontal", equalSpacing?.horizontal)}
        {equalSpacingMarker("vertical", equalSpacing?.vertical)}
        {(distanceLabels || []).map((d, i) => (
          <g key={`dl${i}`}>
            <rect x={d.x - d.text.length * 3 - 4} y={d.y - 9} width={d.text.length * 6 + 8} height={16} rx={3} className="distance-label-bg" />
            <text x={d.x} y={d.y + 3} textAnchor="middle" className="distance-label-text">{d.text}</text>
          </g>
        ))}
      </svg>

      {marquee && marqueeScreen && (
        <div
          className="marquee-rect"
          style={{
            left: marqueeScreen.x,
            top: marqueeScreen.y,
            width: marquee.width * viewport.scale,
            height: marquee.height * viewport.scale,
          }}
        />
      )}

      {guides.map((guide) => (
        <GuideLine
          key={guide.id}
          guide={guide}
          viewport={viewport}
          selected={selectedGuideId === guide.id}
          onDragStart={onGuideDragStart}
          onDelete={onGuideDelete}
          onSelect={onGuideSelect}
        />
      ))}
    </div>
  );
}
