import React, { useEffect, useState } from "react";
import { RectangleHorizontal, RectangleVertical, Repeat2, X } from "lucide-react";
import { PAGE_SIZE_PRESETS, UNITS, findMatchingPreset, getUnit } from "../pageSizes";

export default function ResizeModal({ isOpen, onClose, currentWidth, currentHeight, onApply }) {
  const [unit, setUnit] = useState("px");
  const [widthValue, setWidthValue] = useState(currentWidth);
  const [heightValue, setHeightValue] = useState(currentHeight);

  useEffect(() => {
    if (!isOpen) return;
    const unitDef = getUnit(unit);
    setWidthValue(round(unitDef.fromPx(currentWidth)));
    setHeightValue(round(unitDef.fromPx(currentHeight)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    function handleKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function round(value) {
    return Math.round(value * 100) / 100;
  }

  function changeUnit(nextUnitKey) {
    const currentUnit = getUnit(unit);
    const nextUnit = getUnit(nextUnitKey);
    const widthPx = currentUnit.toPx(widthValue);
    const heightPx = currentUnit.toPx(heightValue);
    setUnit(nextUnitKey);
    setWidthValue(round(nextUnit.fromPx(widthPx)));
    setHeightValue(round(nextUnit.fromPx(heightPx)));
  }

  function applyPreset(preset) {
    onApply(preset.width, preset.height);
    onClose();
  }

  function applyCustom() {
    const unitDef = getUnit(unit);
    const widthPx = Math.round(unitDef.toPx(widthValue));
    const heightPx = Math.round(unitDef.toPx(heightValue));
    if (widthPx > 0 && heightPx > 0) {
      onApply(widthPx, heightPx);
      onClose();
    }
  }

  function swapDimensions() {
    setWidthValue(heightValue);
    setHeightValue(widthValue);
  }

  function setOrientation(orientation) {
    const [small, large] = [Math.min(widthValue, heightValue), Math.max(widthValue, heightValue)];
    if (orientation === "portrait") {
      setWidthValue(small);
      setHeightValue(large);
    } else {
      setWidthValue(large);
      setHeightValue(small);
    }
  }

  const activePreset = findMatchingPreset(currentWidth, currentHeight);
  const isPortrait = heightValue >= widthValue;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Resize page</h2>
          <button
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
            onClick={onClose}
            aria-label="Close resize panel"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Presets</h3>
          <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAGE_SIZE_PRESETS.map((preset) => {
              const active = activePreset?.key === preset.key;
              return (
                <button
                  key={preset.key}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-gray-200 text-gray-700 hover:border-amber-300 hover:bg-amber-50/50"
                  }`}
                  onClick={() => applyPreset(preset)}
                >
                  <span className="block text-sm font-semibold">{preset.label}</span>
                  <span className="block text-xs text-gray-400">
                    {preset.width} × {preset.height} px
                  </span>
                </button>
              );
            })}
          </div>

          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Custom size</h3>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Width</span>
              <input
                type="number"
                min="1"
                className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                value={widthValue}
                onChange={(event) => setWidthValue(Number(event.target.value))}
              />
            </label>

            <button
              className="mb-2 rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              onClick={swapDimensions}
              title="Swap width and height"
              aria-label="Swap width and height"
            >
              <Repeat2 size={16} />
            </button>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Height</span>
              <input
                type="number"
                min="1"
                className="w-28 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                value={heightValue}
                onChange={(event) => setHeightValue(Number(event.target.value))}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-500">Unit</span>
              <select
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400"
                value={unit}
                onChange={(event) => changeUnit(event.target.value)}
              >
                {UNITS.map((unitDef) => (
                  <option key={unitDef.key} value={unitDef.key}>
                    {unitDef.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="mb-0.5 flex gap-1 rounded-lg border border-gray-200 p-1">
              <button
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  isPortrait ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-50"
                }`}
                onClick={() => setOrientation("portrait")}
              >
                <RectangleVertical size={14} /> Portrait
              </button>
              <button
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${
                  !isPortrait ? "bg-amber-100 text-amber-700" : "text-gray-500 hover:bg-gray-50"
                }`}
                onClick={() => setOrientation("landscape")}
              >
                <RectangleHorizontal size={14} /> Landscape
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            onClick={applyCustom}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
