// Phase 12 — deterministic transform composition (spec §10).
//
// DOCUMENTED TRANSFORM ORDER: every renderable item's on-screen transform
// is `translate(x,y) -> rotate(rotation) -> scale(scaleX,scaleY) -> draw
// local content (0,0..width,height)` — this is Konva's own node transform
// order (see App.jsx/DesignNode.jsx: items are plain Konva Groups/Shapes
// with x/y/rotation set directly, no offsetX/offsetY), and is NOT changed
// by animation. What animation adds is a computed override of x/y/rotation/
// scaleX/scaleY/opacity per frame, derived as follows:
//
// 1. An item's un-animated CENTER is `(x,y) + R(rotation) * (width/2, height/2)`
//    — because local point (0,0) is invariant under rotate/scale (it's the
//    translation origin), so the item's "pivot" for rotation/scale is
//    always its stored (x,y), i.e. its un-rotated top-left corner.
// 2. Animated translation (dx,dy) is always expressed in ABSOLUTE PAGE
//    SPACE (not rotated by the item's own rotation) — "slide up" moves up
//    on the page regardless of the object's own rotation. It is added
//    directly to the item's center.
// 3. Animated rotation (drotation, degrees) adds to the item's rotation.
// 4. Animated scale is always UNIFORM (scaleX === scaleY) — deliberately
//    restricts the model to similarity transforms (no shear), which keeps
//    nested-group propagation (below) exact instead of approximate.
// 5. Animated opacity is a MULTIPLIER on the item's base opacity (never a
///   destructive overwrite) — see animationService.js.
// 6. Once the animated CENTER + ROTATION + SCALE are known, x/y are solved
//    backwards so the local origin still maps correctly (step 1, reversed).
//
// GROUP PROPAGATION (spec §10/§24): a group is just a normal item with its
// own x/y/width/height (union of children, hierarchy.js) that may ALSO
// carry its own animation assignment. To animate "the group as one object"
// the user assigns the animation to the GROUP item; to animate "children
// individually" they assign animations to the CHILDREN directly — no
// separate mode flag is needed in the data model. Rendering composes every
// item's animated state by walking its ancestor chain top-down (see
// animationService.js's `computeAncestorComposedState`), accumulating each
// ancestor's own (dx,dy,drotation,scale,opacityFactor) — see that function
// for the exact recurrence. This module only provides the leaf math.

export function itemCenter(base) {
  const rad = ((base.rotation || 0) * Math.PI) / 180;
  const hw = (base.width || 0) / 2;
  const hh = (base.height || 0) / 2;
  return {
    x: base.x + hw * Math.cos(rad) - hh * Math.sin(rad),
    y: base.y + hw * Math.sin(rad) + hh * Math.cos(rad),
  };
}

// Inverse of itemCenter: given a desired center/rotation/scale, solve for
// the (x,y) that Konva needs so the node's local origin lands correctly.
export function xyFromCenter(center, rotation, scale, width, height) {
  const rad = ((rotation || 0) * Math.PI) / 180;
  const hw = ((width || 0) / 2) * scale;
  const hh = ((height || 0) / 2) * scale;
  return {
    x: center.x - (hw * Math.cos(rad) - hh * Math.sin(rad)),
    y: center.y - (hw * Math.sin(rad) + hh * Math.cos(rad)),
  };
}

export const IDENTITY_DELTA = { dx: 0, dy: 0, drotation: 0, scale: 1, opacityFactor: 1 };

export function mergeDeltas(a, b) {
  return {
    dx: a.dx + b.dx,
    dy: a.dy + b.dy,
    drotation: a.drotation + b.drotation,
    scale: a.scale * b.scale,
    opacityFactor: a.opacityFactor * b.opacityFactor,
  };
}

// Composes final render props for `item` given its OWN delta (already
// summed across every currently-active stage on that item — see
// animationService.js) and an ANCESTOR delta already accumulated up to
// (but not including) this item, plus the ancestor chain's structural
// offset — see computeAncestorComposedState in animationService.js, which
// is the actual entry point; this is the leaf-level solve shared by both
// "no ancestors" and "propagated through ancestors" cases.
export function composeRenderState(base, totalDelta) {
  const center = itemCenter(base);
  const finalCenter = { x: center.x + totalDelta.dx, y: center.y + totalDelta.dy };
  const finalRotation = (base.rotation || 0) + totalDelta.drotation;
  const finalScale = Math.max(0.001, totalDelta.scale);
  const { x, y } = xyFromCenter(finalCenter, finalRotation, finalScale, base.width, base.height);
  return {
    x,
    y,
    rotation: finalRotation,
    scaleX: finalScale,
    scaleY: finalScale,
    opacity: Math.min(1, Math.max(0, (base.opacity ?? 1) * totalDelta.opacityFactor)),
  };
}
