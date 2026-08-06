import React from "react";
import { ColorField } from "../../PropertiesToolbar/toolbarUi";
import { useBrandKits } from "../../../brandKitContext";

const SWATCHES = [
  "#ffffff",
  "#f3f4f6",
  "#111827",
  "#fef3c7",
  "#dbeafe",
  "#dcfce7",
  "#fce7f3",
  "#ede9fe",
];

// Page-level (not object-level) background — same unified ColorField used
// for every other color control in the app, so recent colors picked here
// show up in fill/stroke pickers too, and vice versa.
export default function BackgroundsPanel({ background, onBackgroundChange, backgroundStyleRef, onApplyBrandBackgroundStyle }) {
  const { activeBrandKit } = useBrandKits();

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-gray-800">Backgrounds</h3>

      <ColorField
        label="Page background"
        value={background}
        onChange={onBackgroundChange}
        onReset={() => onBackgroundChange("#ffffff")}
      />

      <div className="grid grid-cols-4 gap-2">
        {SWATCHES.map((color) => (
          <button
            key={color}
            className={`h-9 rounded-lg border-2 ${
              background === color ? "border-amber-500" : "border-gray-200"
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onBackgroundChange(color)}
            title={color}
          />
        ))}
      </div>

      {activeBrandKit?.backgroundStyles.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">Brand backgrounds</h4>
          <div className="space-y-1.5">
            {activeBrandKit.backgroundStyles.map((bg) => {
              const color = activeBrandKit.colors.find((c) => c.id === bg.colorId);
              const isApplied = backgroundStyleRef?.brandKitId === activeBrandKit.id && backgroundStyleRef?.styleId === bg.id;
              return (
                <button
                  key={bg.id}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs ${isApplied ? "border-amber-300 bg-amber-50" : "border-gray-200 hover:bg-gray-50"}`}
                  onClick={() => onApplyBrandBackgroundStyle(bg.id)}
                >
                  <span className="h-5 w-5 shrink-0 rounded border border-gray-200" style={{ backgroundColor: color?.hex || bg.color || "#ffffff" }} />
                  <span className="font-medium text-gray-700">{bg.name}</span>
                  {isApplied && <span className="ml-auto text-[10px] font-semibold text-amber-600">Applied</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
