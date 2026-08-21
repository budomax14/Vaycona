import React, { useEffect, useState } from "react";
import { ColorField, IconToggleButton, NumberField, SliderField, ToolbarDivider } from "./toolbarUi";
import OverflowToolbar from "../OverflowToolbar/OverflowToolbar";
import { Ban, Sparkles } from "lucide-react";
import ObjectMoreMenu from "./ObjectMoreMenu";
import ObjectStylePicker from "./ObjectStylePicker";
import TextColorPanel from "./TextColorPanel";
import FadePopover from "./FadePopover";
import { getControls } from "../../objectRegistry";
import { LINE_KIND_ORDER, LINE_KINDS } from "../../lineKinds";
import { BORDER_STYLE_OPTIONS } from "../../borderStyles";
import { normalizeImageFill } from "../../imageFill";
import { useAsset } from "../../useAsset";

export default function ShapePropertiesBar({
  item,
  unit,
  onChange,
  onDuplicate,
  onDelete,
  onForward,
  onBackward,
  onToggleLock,
  onToggleHidden,
  onAlignToPage,
  onEnterImageFillEditMode,
  onExitImageFillEditMode,
  shapeFillOpenRequest,
  onLiveFade,
  onCommitFade,
  onEnterFadeMode,
  isEditingFade,
  brand,
  animationPanelOpen,
  onToggleAnimationPanel,
  hasAnimations,
}) {
  const [isColorPanelOpen, setIsColorPanelOpen] = useState(false);

  // SelectionToolbar's "Shape fill" button lives outside this component, so
  // it can't call setIsColorPanelOpen directly — it bumps shapeFillOpenRequest
  // instead, and this just opens the panel whenever that counter changes.
  useEffect(() => {
    if (shapeFillOpenRequest) setIsColorPanelOpen(true);
  }, [shapeFillOpenRequest]);
  const isLine = item.type === "line";
  const controls = getControls(item);
  const supportsFill = controls.includes("fill");
  const supportsCornerRadius = controls.includes("cornerRadius");
  const supportsLineKind = controls.includes("lineKind");
  const supportsFade = controls.includes("fade");
  const colorBrand = brand?.colorField("fill");
  const { objectUrl: fillImagePreviewUrl } = useAsset(item.fillImage?.assetId);

  return (
    <>
      <OverflowToolbar className="w-full" innerClassName="justify-start gap-3">
        {supportsFill && (
          <OverflowToolbar.Item keepOnMobile>
            <div className="relative shrink-0" data-text-toolbar-safe>
              <button
                type="button"
                className={`h-8 w-10 shrink-0 cursor-pointer rounded-lg border p-0.5 ${isColorPanelOpen ? "border-amber-400 ring-2 ring-amber-100" : "border-gray-200"}`}
                style={{ background: item.fillImage?.assetId || item.fillGradient ? undefined : item.fill || "#8b5cf6" }}
                title="Shape fill"
                aria-label="Shape fill"
                onClick={() => setIsColorPanelOpen((v) => !v)}
              >
                {item.fillImage?.assetId ? (
                  fillImagePreviewUrl && (
                    <span
                      className="block h-full w-full rounded-md bg-cover bg-center"
                      style={{ backgroundImage: `url(${fillImagePreviewUrl})` }}
                    />
                  )
                ) : item.fillGradient ? (
                  <span
                    className="block h-full w-full rounded-md"
                    style={{ background: `linear-gradient(90deg, ${item.fillGradient.stops.map((s) => s.color).join(", ")})` }}
                  />
                ) : null}
              </button>
            </div>
          </OverflowToolbar.Item>
        )}

        <OverflowToolbar.Item keepOnMobile>
          <ColorField
            label={isLine ? "Color" : "Border color"}
            value={item.stroke && item.stroke !== "transparent" ? item.stroke : "#111827"}
            onChange={(value) => onChange({ stroke: value })}
            {...(brand ? brand.colorField("stroke") : {})}
          />
        </OverflowToolbar.Item>

        <OverflowToolbar.Item>
          <>
            {brand && <ObjectStylePicker compatibleWith={item.type} style={brand.objectStyle} />}
            <NumberField
              label={isLine ? "Thickness" : "Border width"}
              value={item.strokeWidth || (isLine ? 4 : 0)}
              min={0}
              max={40}
              onChange={(value) => onChange({ strokeWidth: value })}
            />
          </>
        </OverflowToolbar.Item>

        {!isLine && (
          <OverflowToolbar.Item>
            <>
              <select
                className="h-8 shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
                aria-label="Border style"
                value={item.strokeStyle || "solid"}
                onChange={(event) => onChange({ strokeStyle: event.target.value })}
              >
                {BORDER_STYLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <SliderField
                label="Border opacity"
                value={item.strokeOpacity ?? 1}
                min={0}
                max={1}
                onChange={(value) => onChange({ strokeOpacity: value })}
              />
              <IconToggleButton
                icon={Ban}
                onClick={() => onChange({ strokeWidth: 0 })}
                disabled={!(item.strokeWidth > 0)}
                title="Remove border"
              />
            </>
          </OverflowToolbar.Item>
        )}

        {supportsCornerRadius && (
          <OverflowToolbar.Item>
            <NumberField
              label="Corner radius"
              value={item.cornerRadius || 0}
              min={0}
              max={100}
              onChange={(value) => onChange({ cornerRadius: value })}
            />
          </OverflowToolbar.Item>
        )}

        {supportsLineKind && (
          <OverflowToolbar.Item>
            <select
              className="h-8 shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-2 text-sm text-gray-700 outline-none focus:border-amber-400 focus:bg-white"
              aria-label="Line style"
              value={item.lineKind || "straight"}
              onChange={(event) => onChange({ lineKind: event.target.value })}
            >
              {LINE_KIND_ORDER.map((kind) => (
                <option key={kind} value={kind}>
                  {LINE_KINDS[kind].label}
                </option>
              ))}
            </select>
          </OverflowToolbar.Item>
        )}

        <OverflowToolbar.Item>
          <>
            <ToolbarDivider />
            <SliderField
              label="Opacity"
              value={item.opacity ?? 1}
              min={0.1}
              max={1}
              onChange={(value) => onChange({ opacity: value })}
            />
          </>
        </OverflowToolbar.Item>

        {supportsFade && (
          <OverflowToolbar.Item>
            <FadePopover
              opacityMask={item.opacityMask}
              onChange={(opacityMask) => onChange({ opacityMask })}
              onLiveChange={onLiveFade}
              onCommit={onCommitFade}
              onEnterEditMode={onEnterFadeMode}
              isEditingOnCanvas={isEditingFade}
            />
          </OverflowToolbar.Item>
        )}

        {!isLine && (
          <OverflowToolbar.Item>
            <>
              <ToolbarDivider />
              <IconToggleButton
                icon={Sparkles}
                active={!!item.shadow}
                onClick={() => onChange({ shadow: !item.shadow })}
                title="Toggle shadow"
              />
              {item.shadow && (
                <NumberField
                  label="Shadow blur"
                  value={item.shadowBlur ?? 12}
                  min={0}
                  max={60}
                  onChange={(value) => onChange({ shadowBlur: value })}
                />
              )}
            </>
          </OverflowToolbar.Item>
        )}

        <OverflowToolbar.Item keepOnMobile>
          <>
            <ToolbarDivider />
            <ObjectMoreMenu
              item={item}
              unit={unit}
              onChange={onChange}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onForward={onForward}
              onBackward={onBackward}
              onToggleLock={onToggleLock}
              onToggleHidden={onToggleHidden}
              onAlignToPage={onAlignToPage}
              animationPanelOpen={animationPanelOpen}
              onToggleAnimationPanel={onToggleAnimationPanel}
              hasAnimations={hasAnimations}
            />
          </>
        </OverflowToolbar.Item>
      </OverflowToolbar>

      {supportsFill && (
        <TextColorPanel
          isOpen={isColorPanelOpen}
          onClose={() => setIsColorPanelOpen(false)}
          title="Shape fill"
          imageFillDescription="Fill this shape with an image, clipped to the shape's outline."
          solidValue={item.fill || "#8b5cf6"}
          gradientValue={item.fillGradient || null}
          imageValue={item.fillImage || null}
          imageBoxWidth={item.width}
          imageBoxHeight={item.height}
          onChangeSolid={(hex) => {
            if (item.fillGradient || item.fillImage) onChange({ fill: hex, fillGradient: undefined, fillImage: undefined });
            else onChange({ fill: hex });
          }}
          onChangeGradient={(gradient) => onChange({ fillGradient: gradient, fillImage: undefined })}
          onChangeImage={(patch) => onChange({ fillImage: { ...normalizeImageFill(item.fillImage), ...patch }, fillGradient: undefined })}
          onPickImageAsset={(assetId) => {
            const current = normalizeImageFill(item.fillImage);
            onChange({
              fillImage: { ...current, assetId, zoom: 1, offsetX: 0.5, offsetY: 0.5, rotation: 0 },
              fillGradient: undefined,
            });
          }}
          onRemoveImage={() => onChange({ fillImage: undefined })}
          onImageTabActiveChange={(isActive) => {
            if (isActive && item.fillImage?.assetId) onEnterImageFillEditMode?.();
            else onExitImageFillEditMode?.();
          }}
          tokenRef={colorBrand?.tokenRef}
          onApplyToken={colorBrand?.onApplyToken}
          onDetach={
            colorBrand?.onDetach
              ? () => {
                  colorBrand.onDetach();
                  setIsColorPanelOpen(false);
                }
              : undefined
          }
        />
      )}
    </>
  );
}
