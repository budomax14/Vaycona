import React, { useMemo, useState } from "react";
import { X, Play, Pause, Trash2, Sparkles } from "lucide-react";
import {
  getPresetsByCategory,
  IMAGE_MOTION_PRESETS,
  isPresetSupportedForType,
} from "../../animation/animationRegistry";
import { EASING_IDS, EASING_LABELS } from "../../animation/easing";
import { DIRECTIONS, INTENSITIES, createMotionPathDefaults } from "../../animation/animationSchema";
import { detectAnimationConflicts } from "../../animation/animationService";

const CATEGORY_LABELS = { entrance: "Entrance", exit: "Exit", emphasis: "Emphasis", motion: "Motion" };
const CATEGORIES = ["entrance", "emphasis", "exit", "motion"];

function PresetGrid({ presets, activePresetId, onPick }) {
  const [query, setQuery] = useState("");
  const filtered = presets.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search presets..."
        className="w-full rounded border border-gray-200 px-2 py-1 text-xs"
        aria-label="Search animation presets"
      />
      <div className="grid max-h-40 grid-cols-2 gap-1 overflow-y-auto">
        {filtered.map((p) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            className={`truncate rounded border px-2 py-1.5 text-left text-xs ${
              activePresetId === p.id ? "border-amber-400 bg-amber-50 text-amber-700" : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
            }`}
            title={p.description}
          >
            {p.intense && <span className="mr-1 text-amber-500" title="May flash/shake rapidly">⚠</span>}
            {p.name}
          </button>
        ))}
        {filtered.length === 0 && <div className="col-span-2 py-2 text-center text-xs text-gray-400">No presets found.</div>}
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange, step = 1, min, max, suffix }) {
  return (
    <label className="flex flex-col gap-0.5 text-[11px] text-gray-500">
      {label}
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded border border-gray-200 px-1.5 py-1 text-xs text-gray-800"
        />
        {suffix && <span className="text-[10px] text-gray-400">{suffix}</span>}
      </div>
    </label>
  );
}

// Phase 12 — the single Animation panel (spec §15). Applies/edits/removes
// animations via App.jsx's commit-backed handlers only; never computes a
// frame itself (all preview math still goes through animationService via
// App.jsx's shared preview engine).
export default function AnimationPanel({
  selectedItems,
  page,
  reducedMotion,
  onClose,
  onApply,
  onApplyToSelection,
  onRemove,
  onRemoveStage,
  onRemoveAll,
  onRemoveAllFromSelection,
  onUpdateTiming,
  onSetMotionPath,
  onRemoveMotionPath,
  previewTimeMs,
  isPreviewPlaying,
  onPreviewSeek,
  onPreviewPlay,
  onPreviewPause,
  reducedMotionOverride,
  onSetReducedMotionOverride,
}) {
  const [activeCategory, setActiveCategory] = useState("entrance");
  const isMulti = selectedItems.length > 1;
  const single = !isMulti ? selectedItems[0] : null;
  const [staggerDelay, setStaggerDelay] = useState(150);
  const [applyMode, setApplyMode] = useState("together"); // together | stagger

  const presetsForCategory = useMemo(() => {
    const base = getPresetsByCategory(activeCategory);
    const extra = activeCategory === "motion" && single && (single.type === "image" || single.type === "frame") ? IMAGE_MOTION_PRESETS : [];
    const type = single?.type || (selectedItems[0] && selectedItems.every((it) => it.type === selectedItems[0].type) ? selectedItems[0].type : null);
    const all = [...base, ...extra];
    return type ? all.filter((p) => isPresetSupportedForType(p.id, type)) : all;
  }, [activeCategory, single, selectedItems]);

  const currentAnim = single?.animations?.find((a) => a.stage === activeCategory && activeCategory !== "motion")
    || single?.animations?.find((a) => a.stage === "motion" && activeCategory === "motion");

  const conflicts = single ? detectAnimationConflicts(single, page?.duration || 5000) : [];

  function pickPreset(presetId) {
    if (isMulti) {
      onApplyToSelection(
        selectedItems.map((it) => it.id),
        activeCategory,
        presetId,
        { staggerDelayMs: applyMode === "stagger" ? staggerDelay : 0 }
      );
    } else if (single) {
      onApply(single.id, activeCategory, presetId, currentAnim ? { direction: currentAnim.direction, intensity: currentAnim.intensity } : {});
    }
  }

  return (
    <div className="absolute top-3 right-3 z-30 flex max-h-[calc(100%-1.5rem)] w-72 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <Sparkles size={14} className="text-amber-600" />
          Animate
        </div>
        <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Close animation panel">
          <X size={14} />
        </button>
      </div>

      <div className="flex border-b border-gray-200 text-xs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-1 py-2 font-medium ${activeCategory === cat ? "border-b-2 border-amber-600 text-amber-700" : "text-gray-500 hover:text-gray-700"}`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto p-3">
        <label className="flex items-center justify-between rounded border border-gray-200 px-2 py-1.5 text-[11px] text-gray-600">
          Reduced motion
          <select
            value={reducedMotionOverride}
            onChange={(e) => onSetReducedMotionOverride(e.target.value)}
            className="rounded border border-gray-200 px-1 py-0.5 text-[11px]"
          >
            <option value="system">System</option>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </label>
        {reducedMotion && (
          <div className="rounded bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
            Reduced motion is on — intense presets are substituted with a safer fallback in preview/presentation.
          </div>
        )}

        {isMulti && (
          <div className="flex flex-col gap-1.5 rounded border border-gray-200 p-2 text-xs">
            <div className="font-medium text-gray-700">{selectedItems.length} objects selected</div>
            <div className="flex gap-1">
              <button
                onClick={() => setApplyMode("together")}
                className={`flex-1 rounded px-2 py-1 ${applyMode === "together" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}
              >
                Together
              </button>
              <button
                onClick={() => setApplyMode("stagger")}
                className={`flex-1 rounded px-2 py-1 ${applyMode === "stagger" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}
              >
                Staggered
              </button>
            </div>
            {applyMode === "stagger" && (
              <NumberField label="Stagger delay (ms)" value={staggerDelay} onChange={setStaggerDelay} step={50} min={0} max={5000} />
            )}
          </div>
        )}

        <PresetGrid presets={presetsForCategory} activePresetId={currentAnim?.presetId} onPick={pickPreset} />

        {single && currentAnim && (
          <div className="flex flex-col gap-2 rounded border border-gray-200 p-2">
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Duration" value={currentAnim.duration} step={50} min={50} max={20000} suffix="ms" onChange={(v) => onUpdateTiming(single.id, currentAnim.id, { duration: v })} />
              <NumberField label="Delay" value={currentAnim.delay} step={50} min={0} max={30000} suffix="ms" onChange={(v) => onUpdateTiming(single.id, currentAnim.id, { delay: v })} />
              <NumberField label="Start time" value={currentAnim.startTime} step={50} min={0} suffix="ms" onChange={(v) => onUpdateTiming(single.id, currentAnim.id, { startTime: v })} />
              {(currentAnim.stage === "emphasis" || currentAnim.stage === "motion") && (
                <NumberField label="Repeat" value={currentAnim.repeatCount} step={1} min={1} max={50} onChange={(v) => onUpdateTiming(single.id, currentAnim.id, { repeatCount: v })} />
              )}
            </div>

            <label className="flex flex-col gap-0.5 text-[11px] text-gray-500">
              Easing
              <select
                value={currentAnim.easing}
                onChange={(e) => onUpdateTiming(single.id, currentAnim.id, { easing: e.target.value })}
                className="rounded border border-gray-200 px-1.5 py-1 text-xs"
              >
                {EASING_IDS.map((id) => (
                  <option key={id} value={id}>{EASING_LABELS[id]}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-0.5 text-[11px] text-gray-500">
              Intensity
              <div className="flex gap-1">
                {INTENSITIES.map((level) => (
                  <button
                    key={level}
                    onClick={() => onUpdateTiming(single.id, currentAnim.id, { intensity: level })}
                    className={`flex-1 rounded px-2 py-1 text-xs capitalize ${currentAnim.intensity === level ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </label>

            <label className="flex flex-col gap-0.5 text-[11px] text-gray-500">
              Direction
              <select
                value={currentAnim.direction || ""}
                onChange={(e) => onUpdateTiming(single.id, currentAnim.id, { direction: e.target.value || null })}
                className="rounded border border-gray-200 px-1.5 py-1 text-xs"
              >
                <option value="">Default</option>
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>

            {(currentAnim.stage === "emphasis" || currentAnim.stage === "motion") && (
              <label className="flex items-center gap-1.5 text-[11px] text-gray-600">
                <input
                  type="checkbox"
                  checked={currentAnim.loopBehavior === "loop"}
                  onChange={(e) => onUpdateTiming(single.id, currentAnim.id, { loopBehavior: e.target.checked ? "loop" : "none" })}
                />
                Loop continuously
              </label>
            )}

            {conflicts.length > 0 && (
              <div className="rounded bg-amber-50 px-2 py-1 text-[10px] text-amber-700">
                {conflicts.map((c) => <div key={c.code}>⚠ {c.message}</div>)}
              </div>
            )}

            <button
              onClick={() => onRemoveStage(single.id, currentAnim.stage)}
              className="flex items-center justify-center gap-1 rounded border border-red-200 py-1 text-xs text-red-600 hover:bg-red-50"
            >
              <Trash2 size={12} /> Remove {activeCategory}
            </button>
          </div>
        )}

        {single && activeCategory === "motion" && single.type !== "line" && (
          <div className="flex flex-col gap-1.5 rounded border border-gray-200 p-2 text-xs">
            <div className="font-medium text-gray-700">Motion path</div>
            {single.motionPath ? (
              <button onClick={() => onRemoveMotionPath(single.id)} className="flex items-center justify-center gap-1 rounded border border-red-200 py-1 text-red-600 hover:bg-red-50">
                <Trash2 size={12} /> Delete path
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button
                  className="flex-1 rounded bg-gray-100 py-1 text-gray-700 hover:bg-gray-200"
                  onClick={() => {
                    const path = createMotionPathDefaults(single.id, [
                      { x: single.x + single.width / 2, y: single.y + single.height / 2 },
                      { x: single.x + single.width / 2 + 200, y: single.y + single.height / 2 },
                    ]);
                    onSetMotionPath(single.id, path);
                    onApply(single.id, "motion", "customMotionPath", {});
                  }}
                >
                  Straight path
                </button>
                <button
                  className="flex-1 rounded bg-gray-100 py-1 text-gray-700 hover:bg-gray-200"
                  onClick={() => {
                    const cx = single.x + single.width / 2;
                    const cy = single.y + single.height / 2;
                    const path = createMotionPathDefaults(single.id, [
                      { x: cx, y: cy },
                      { x: cx + 100, y: cy - 120 },
                      { x: cx + 200, y: cy },
                    ]);
                    onSetMotionPath(single.id, path);
                    onApply(single.id, "motion", "customMotionPath", {});
                  }}
                >
                  Curved path
                </button>
              </div>
            )}
            <p className="text-[10px] text-gray-400">
              Basic path editor: use these presets to place a straight or curved path, then fine-tune point positions from the Timeline. A full drag-to-draw editor isn't available this phase.
            </p>
          </div>
        )}

        {single && (single.animations?.length > 0 || single.motionPath) && (
          <button
            onClick={() => onRemoveAll(single.id)}
            className="flex items-center justify-center gap-1 rounded border border-gray-200 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
          >
            Remove all animations from this object
          </button>
        )}
        {isMulti && (
          <button
            onClick={() => onRemoveAllFromSelection(selectedItems.map((it) => it.id))}
            className="flex items-center justify-center gap-1 rounded border border-gray-200 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
          >
            Remove all animations from selection ({selectedItems.length})
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-gray-200 px-3 py-2">
        <button
          onClick={isPreviewPlaying ? onPreviewPause : onPreviewPlay}
          className="flex items-center gap-1 rounded bg-gray-900 px-2 py-1 text-xs text-white hover:bg-gray-800"
        >
          {isPreviewPlaying ? <Pause size={12} /> : <Play size={12} />}
          {isPreviewPlaying ? "Pause" : "Preview"}
        </button>
        <input
          type="range"
          min={0}
          max={page?.duration || 5000}
          value={Math.min(previewTimeMs, page?.duration || 5000)}
          onChange={(e) => onPreviewSeek(Number(e.target.value))}
          className="flex-1"
          aria-label="Preview scrub"
        />
      </div>
    </div>
  );
}
