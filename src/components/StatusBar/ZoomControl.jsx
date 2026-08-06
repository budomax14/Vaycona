import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { ZOOM_PRESETS } from "../../constants";
import PopoverPortal from "./PopoverPortal";

export default function ZoomControl({ scale, onZoomTo, onZoomIn, onZoomOut }) {
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState(null);
  const triggerRef = useRef(null);
  const contentRef = useRef(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setAnchorRect(null);
      return;
    }
    setAnchorRect(triggerRef.current.getBoundingClientRect());
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function handleOutside(event) {
      const inTrigger = triggerRef.current?.contains(event.target);
      const inContent = contentRef.current?.contains(event.target);
      if (!inTrigger && !inContent) setOpen(false);
    }
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [open]);

  return (
    <div className="flex items-center gap-1">
      <button className="rounded-md p-1 text-gray-500 hover:bg-gray-100" onClick={onZoomOut} title="Zoom out">
        <Minus size={14} />
      </button>

      <input
        type="number"
        className="w-11 rounded-md bg-transparent px-1 py-1 text-right text-xs font-semibold text-gray-600 outline-none hover:bg-gray-100 focus:bg-white focus:ring-1 focus:ring-amber-300"
        value={Math.round(scale * 100)}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isFinite(value) && value > 0) onZoomTo(value / 100);
        }}
        aria-label="Zoom percentage"
      />
      <span className="text-xs text-gray-500">%</span>

      <button
        ref={triggerRef}
        className="rounded-md p-1 text-gray-500 hover:bg-gray-100"
        onClick={() => setOpen((v) => !v)}
        aria-label="Zoom presets"
        aria-expanded={open}
      >
        <ChevronDown size={12} />
      </button>

      <PopoverPortal ref={contentRef} anchorRect={anchorRect} align="right">
        {open && (
          <div className="min-w-25 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
            {ZOOM_PRESETS.map((preset) => (
              <button
                key={preset}
                className="block w-full rounded-md px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-amber-50 hover:text-amber-700"
                onClick={() => {
                  onZoomTo(preset);
                  setOpen(false);
                }}
              >
                {Math.round(preset * 100)}%
              </button>
            ))}
          </div>
        )}
      </PopoverPortal>

      <button className="rounded-md p-1 text-gray-500 hover:bg-gray-100" onClick={onZoomIn} title="Zoom in">
        <Plus size={14} />
      </button>
    </div>
  );
}
