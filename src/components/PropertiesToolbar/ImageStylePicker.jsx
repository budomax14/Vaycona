import React, { useRef, useState } from "react";
import { ImagePlus, Link2, Unlink } from "lucide-react";
import { useBrandKits } from "../../brandKitContext";
import ToolbarPopover from "./ToolbarPopover";

// Image-style equivalent of ObjectStylePicker.jsx (spec §40-41/§56-58) —
// adjustments/border/cornerRadius/shadow/opacity presets, non-destructive
// (source asset/crop are never touched, see brandKitService.createImageStyle).
export default function ImageStylePicker({ style: brand }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const { activeBrandKit } = useBrandKits();

  if (!activeBrandKit) return null;
  const styles = activeBrandKit.imageStyles;
  const linkedStyleId = brand.ref?.brandKitId === activeBrandKit.id ? brand.ref?.styleId : null;

  return (
    <div className="relative shrink-0">
      <div ref={anchorRef} className="inline-flex">
        <button
          className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium ${linkedStyleId ? "bg-amber-100 text-amber-700" : "text-gray-600 hover:bg-gray-100"}`}
          onClick={() => setOpen((v) => !v)}
          title="Brand image styles"
        >
          <ImagePlus size={15} /> Styles
        </button>
      </div>
      <ToolbarPopover isOpen={open} anchorRef={anchorRef} onClose={() => setOpen(false)}>
        <div className="w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          {linkedStyleId && (
            <button
              className="mb-2 flex w-full items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
              onClick={() => { brand.onDetach(); setOpen(false); }}
            >
              <Unlink size={12} /> Detach current style
            </button>
          )}
          {styles.length === 0 && <p className="px-1 py-1 text-xs text-gray-400">No image styles yet.</p>}
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {styles.map((s) => (
              <button
                key={s.id}
                className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-gray-50 ${linkedStyleId === s.id ? "bg-amber-50" : ""}`}
                onClick={() => { brand.onApply(s.id); setOpen(false); }}
              >
                <span className="font-medium text-gray-700">{s.name}</span>
                {linkedStyleId === s.id && <Link2 size={11} className="text-amber-600" />}
              </button>
            ))}
          </div>
          <button
            className="mt-2 w-full rounded-lg border border-dashed border-gray-300 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
            onClick={() => { brand.onCreateFromSelection(); setOpen(false); }}
          >
            + Save current edits as style
          </button>
        </div>
      </ToolbarPopover>
    </div>
  );
}
