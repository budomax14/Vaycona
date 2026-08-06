import { SHAPE_KINDS } from "./shapeKinds";
import { LINE_KINDS } from "./lineKinds";
import { FRAME_KINDS } from "./frameKinds";
import ShapeNode from "./nodes/ShapeNode";
import LineNode from "./nodes/LineNode";
import IconNode from "./nodes/IconNode";
import FrameNode from "./nodes/FrameNode";
import TextNode from "./nodes/TextNode";
import ImageNode from "./nodes/ImageNode";
import ShapePropertiesBar from "./components/PropertiesToolbar/ShapePropertiesBar";
import TextPropertiesBar from "./components/PropertiesToolbar/TextPropertiesBar";
import ImagePropertiesBar from "./components/PropertiesToolbar/ImagePropertiesBar";
import IconPropertiesBar from "./components/PropertiesToolbar/IconPropertiesBar";
import FramePropertiesBar from "./components/PropertiesToolbar/FramePropertiesBar";
import GroupPropertiesBar from "./components/PropertiesToolbar/GroupPropertiesBar";
import { defaultTextEffects } from "./textEffects";
import { DEFAULT_CROP } from "./imageCrop";
import { DEFAULT_ADJUSTMENTS } from "./imageEffects";

// One entry per top-level `type`. `shape`/`line`/`frame` hold an internal
// `kinds` lookup for the axis that actually varies (geometry/behavior);
// `text`/`image`/`icon` don't need one. This is the *only* place `item.type`
// is switched on for rendering/toolbar purposes anywhere in the app —
// DesignNode.jsx and PropertiesToolbar.jsx both just look entries up here.
export const REGISTRY = {
  text: {
    displayName: "Text",
    renderer: TextNode,
    propertiesBar: TextPropertiesBar,
    editableText: true,
    defaultProps: () => ({
      text: "Add text",
      fontSize: 24,
      fontFamily: "Arial",
      fontWeight: "normal",
      italic: false,
      underline: false,
      strikethrough: false,
      fill: "#111827",
      align: "left",
      verticalAlign: "middle",
      lineHeight: 1,
      letterSpacing: 0,
      paragraphSpacing: 0,
      textTransform: "none",
      autoSize: "auto-height",
      overflow: "clip",
      padding: 4,
      direction: "ltr",
      whiteSpace: "normal",
      background: { enabled: false, color: "#ffffff", opacity: 1, cornerRadius: 0 },
      border: { enabled: false, color: "#111827", width: 1, style: "solid" },
      effects: defaultTextEffects(),
      curve: 0,
      flipX: false,
      flipY: false,
    }),
    controls: () => [
      "fill", "fontFamily", "fontSize", "fontWeight", "italic", "underline", "strikethrough",
      "textAlign", "verticalAlign", "lineHeight", "letterSpacing", "paragraphSpacing",
      "textTransform", "list", "autoSize", "overflow", "background", "border", "effects", "opacity",
    ],
    transforms: { resizable: true, rotatable: true, usesTransformer: true },
  },

  shape: {
    displayName: "Shape",
    kinds: SHAPE_KINDS,
    renderer: ShapeNode,
    propertiesBar: ShapePropertiesBar,
    defaultProps: (shapeKind = "rectangle") => ({
      shapeKind,
      fill: "#8b5cf6",
      stroke: "transparent",
      strokeWidth: 0,
      strokeStyle: "solid",
      strokeOpacity: 1,
      ...(SHAPE_KINDS[shapeKind]?.extraDefaults ?? {}),
    }),
    controls: (item) => [
      "fill",
      "stroke",
      "strokeWidth",
      "strokeStyle",
      "strokeOpacity",
      "opacity",
      ...(SHAPE_KINDS[item.shapeKind]?.extraControls ?? []),
    ],
    transforms: (item) => ({
      resizable: true,
      rotatable: true,
      usesTransformer: true,
      ...(SHAPE_KINDS[item.shapeKind]?.transformsOverride ?? {}),
    }),
  },

  line: {
    displayName: "Line",
    kinds: LINE_KINDS,
    renderer: LineNode,
    propertiesBar: ShapePropertiesBar,
    defaultProps: (lineKind = "straight") => ({
      lineKind,
      height: 0,
      stroke: "#111827",
      strokeWidth: 4,
    }),
    controls: () => ["stroke", "strokeWidth", "lineKind", "opacity"],
    transforms: { resizable: true, rotatable: true, usesTransformer: false, usesEndpointHandles: true },
    // Lines already opt out of the shared multi-node Transformer (they use
    // endpoint handles instead), so when a line is a member of a group
    // being resized/rotated, it can't ride along on Konva's native
    // multi-node transform like every other leaf type. `applyMatrix` is
    // the fallback used only for that case (see App.jsx's group
    // transform-end handling): given a `transformPoint` function mapping
    // an old absolute point to its new absolute position, re-derive the
    // line's x/y/width/rotation from its two transformed endpoints.
    applyMatrix: (item, transformPoint) => {
      const rad = ((item.rotation || 0) * Math.PI) / 180;
      const start = { x: item.x, y: item.y };
      const end = {
        x: item.x + (item.width || 0) * Math.cos(rad),
        y: item.y + (item.width || 0) * Math.sin(rad),
      };
      const newStart = transformPoint(start);
      const newEnd = transformPoint(end);
      const dx = newEnd.x - newStart.x;
      const dy = newEnd.y - newStart.y;
      return {
        x: newStart.x,
        y: newStart.y,
        width: Math.max(1, Math.hypot(dx, dy)),
        rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
      };
    },
  },

  image: {
    displayName: "Image",
    renderer: ImageNode,
    propertiesBar: ImagePropertiesBar,
    defaultProps: () => ({
      assetId: null,
      cornerRadius: 0,
      flipX: false,
      flipY: false,
      crop: { ...DEFAULT_CROP },
      adjustments: { ...DEFAULT_ADJUSTMENTS },
      naturalWidth: null,
      naturalHeight: null,
    }),
    controls: () => ["cornerRadius", "opacity"],
    transforms: { resizable: true, rotatable: true, usesTransformer: true },
  },

  icon: {
    displayName: "Icon",
    renderer: IconNode,
    propertiesBar: IconPropertiesBar,
    defaultProps: (iconName) => ({ iconName, fill: "#111827" }),
    controls: () => ["fill", "opacity"],
    transforms: { resizable: true, rotatable: true, usesTransformer: true },
  },

  frame: {
    displayName: "Frame",
    kinds: FRAME_KINDS,
    renderer: FrameNode,
    propertiesBar: FramePropertiesBar,
    defaultProps: (frameKind = "rectangle") => ({
      frameKind,
      // Frame owns its content directly (assetId + crop live on the frame
      // item itself) rather than a separate child image item — see
      // imageCrop.js / hierarchy.js notes for why. contentAssetId replaces
      // the old placeholder-only contentSrc field.
      contentAssetId: null,
      crop: { ...DEFAULT_CROP },
      adjustments: { ...DEFAULT_ADJUSTMENTS },
      flipX: false,
      flipY: false,
      cornerRadius: 0,
      ...(FRAME_KINDS[frameKind]?.extraDefaults ?? {}),
    }),
    controls: () => ["opacity"],
    transforms: (item) => ({
      resizable: true,
      rotatable: true,
      usesTransformer: true,
      ...(FRAME_KINDS[item.frameKind]?.transformsOverride ?? {}),
    }),
  },

  group: {
    displayName: "Group",
    // No renderer: a group is a pure bookkeeping/selection entity with no
    // visual footprint of its own (see hierarchy.js) — DesignNode.jsx's
    // existing "if (Renderer) return <Renderer/>; return null;" already
    // handles this for free.
    propertiesBar: GroupPropertiesBar,
    defaultProps: () => ({ name: "Group" }),
    // No per-object color/typography controls — group opacity isn't
    // meaningfully supported this phase (there's no real composited Konva
    // node to apply it to; see plan). GroupPropertiesBar renders its own
    // fixed control set directly rather than reading this list.
    controls: () => [],
    transforms: { resizable: true, rotatable: true, usesTransformer: true },
  },
};

export function getEntry(item) {
  return REGISTRY[item?.type];
}

export function getRenderer(type) {
  return REGISTRY[type]?.renderer ?? null;
}

export function getPropertiesBar(type) {
  return REGISTRY[type]?.propertiesBar ?? null;
}

export function getControls(item) {
  const entry = getEntry(item);
  if (!entry) return [];
  return typeof entry.controls === "function" ? entry.controls(item) : entry.controls || [];
}

export function getTransforms(item) {
  const entry = getEntry(item);
  if (!entry) return {};
  return typeof entry.transforms === "function" ? entry.transforms(item) : entry.transforms || {};
}

export function getDefaultProps(type, kind) {
  return REGISTRY[type]?.defaultProps?.(kind) ?? {};
}

export function getApplyMatrix(type) {
  return REGISTRY[type]?.applyMatrix ?? null;
}

export function getDisplayName(item) {
  const entry = getEntry(item);
  const kind = item?.shapeKind ?? item?.lineKind ?? item?.frameKind ?? item?.iconName;
  const kindTable = entry?.kinds;
  return kindTable?.[kind]?.label ?? entry?.displayName ?? "Object";
}
