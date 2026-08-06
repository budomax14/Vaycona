import React from "react";

// Lightweight, real (not fake) preview built directly from a template's
// own page background + first few objects, scaled into a fixed-aspect
// box — used wherever a full Konva-rendered thumbnail isn't available yet
// (built-ins, or a user template before its first captured screenshot).
// Deliberately simple: a handful of absolutely-positioned boxes/text, not
// a full render — see Phase 8 completion notes on why a full off-screen
// Konva thumbnail pipeline was out of scope for this checkpoint.
export default function TemplateMiniPreview({ page, items, className = "" }) {
  if (!page) {
    return <div className={`flex items-center justify-center bg-gray-100 text-gray-300 ${className}`}>—</div>;
  }
  const scaleX = 100 / page.width;
  const scaleY = 100 / page.height;
  const visible = (items || []).filter((it) => it.pageId === page.id && !it.hidden).slice(0, 12);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ backgroundColor: page.background || "#ffffff" }}>
      {visible.map((item) => {
        const style = {
          position: "absolute",
          left: `${item.x * scaleX}%`,
          top: `${item.y * scaleY}%`,
          width: `${Math.max(item.width * scaleX, 1)}%`,
          height: `${Math.max(item.height * scaleY, 1)}%`,
          opacity: item.opacity ?? 1,
          transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
        };
        if (item.type === "text") {
          return (
            <div
              key={item.id}
              style={{ ...style, color: item.fill || "#111827", fontSize: Math.max(2, (item.fontSize || 16) * scaleY * 3), fontWeight: item.fontWeight, textAlign: item.align, overflow: "hidden" }}
            >
              {item.text}
            </div>
          );
        }
        if (item.type === "shape" || item.type === "frame") {
          return (
            <div
              key={item.id}
              style={{
                ...style,
                backgroundColor: item.fill || "#e5e7eb",
                borderRadius: item.shapeKind === "circle" ? "50%" : item.cornerRadius ? Math.min(item.cornerRadius * scaleY, 12) : 0,
              }}
            />
          );
        }
        if (item.type === "icon") {
          return <div key={item.id} style={{ ...style, backgroundColor: item.fill || "#9ca3af", borderRadius: "20%" }} />;
        }
        return null;
      })}
    </div>
  );
}
