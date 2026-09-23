import { useEffect, useRef, useState } from "react";
import { downscaleForMobile, computeMobileDownscaleTarget, isMobileDevice } from "./canvasPixelBudget";

// crop: { top, right, bottom, left } as percentages (0-100) of the natural
// image dimensions, applied after flip so insets match what's shown in the
// properties toolbar.
export function cropInsetsToRect(crop, naturalWidth, naturalHeight) {
  if (!crop || !naturalWidth || !naturalHeight) return null;
  const { top = 0, right = 0, bottom = 0, left = 0 } = crop;
  const width = naturalWidth * (1 - (left + right) / 100);
  const height = naturalHeight * (1 - (top + bottom) / 100);
  if (width <= 0 || height <= 0) return null;
  return {
    x: (left / 100) * naturalWidth,
    y: (top / 100) * naturalHeight,
    width,
    height,
  };
}

// Flip is drawn onto a cached offscreen canvas rather than expressed via
// Konva's scaleX/scaleY, because handleTransformEnd (App.jsx) reads
// node.scaleX()/scaleY() directly to compute resized width/height — reusing
// scale for flip would conflate flip with resize and corrupt that math.
// Safe without a crossOrigin attribute because every caller feeds this hook
// a same-origin blob: URL from useAsset() (never a remote http(s) source) —
// same-origin resources can't taint the canvas regardless. Setting
// crossOrigin="anonymous" on a blob: URL is actively harmful: Safari fails
// to load it (a known WebKit blob-URL+CORS bug), which is why uploaded
// images rendered as invisible/missing there.
// meta: optional { width, height } — the asset's real natural dimensions,
// recorded once at upload time (see assetStore.js) and passed down from
// useAsset()'s own return value. When present on mobile, lets the decode
// itself skip straight to a safe size (see loadViaImageBitmap below)
// instead of decoding at native resolution first.
export function useImageElement(src, { flipX = false, flipY = false, meta } = {}) {
  const [baseImage, setBaseImage] = useState(null);
  const [renderedImage, setRenderedImage] = useState(null);
  const flippedCanvasRef = useRef(null);
  const activeBitmapRef = useRef(null);

  useEffect(() => {
    if (!src) {
      setBaseImage(null);
      return undefined;
    }

    let cancelled = false;

    function adoptBitmap(bitmap) {
      if (activeBitmapRef.current) activeBitmapRef.current.close();
      activeBitmapRef.current = bitmap;
      setBaseImage(bitmap);
    }

    function loadViaImageElement() {
      const img = new window.Image();
      img.onload = () => {
        if (cancelled) return;
        const working = downscaleForMobile(img);
        // Drop the full-resolution decode once a smaller copy replaces it.
        if (working !== img) img.src = "";
        setBaseImage(working);
      };
      img.onerror = () => {
        if (!cancelled) setBaseImage(null);
      };
      img.src = src;
    }

    // A modern phone photo can be 12-48MP: new Image()'s onload implies a
    // full-resolution decode (WebKit materializes the whole decoded bitmap
    // to fire it) BEFORE downscaleForMobile's canvas step ever gets a
    // chance to shrink it — a large, sudden allocation on top of whatever
    // the Stage/other layers already hold, right as a freshly-added image
    // has its first real draw (a Web Inspector session on the actual crash
    // caught exactly this: a sudden memory spike, no thrown error, right
    // after this image's load resolved). createImageBitmap's resizeWidth/
    // resizeHeight decode straight to the smaller target instead — real
    // decoder-level savings, not a redraw after the fact — and .close()
    // releases the bitmap deterministically instead of waiting on GC.
    // Requires knowing natural size up front (meta, from asset upload-time
    // metadata) since there's no image to measure yet; falls back to the
    // plain <img> path for any other source (fill images, etc.) or if the
    // browser/format can't do it.
    const canUseBitmap = isMobileDevice() && typeof window.createImageBitmap === "function" && meta?.width > 0 && meta?.height > 0;

    if (canUseBitmap) {
      const target = computeMobileDownscaleTarget(meta.width, meta.height) || { width: meta.width, height: meta.height };
      fetch(src)
        .then((response) => response.blob())
        .then((blob) => {
          if (cancelled) throw new Error("cancelled");
          return createImageBitmap(blob, {
            resizeWidth: target.width,
            resizeHeight: target.height,
            resizeQuality: "medium",
          });
        })
        .then((bitmap) => {
          if (cancelled) {
            bitmap.close();
            return;
          }
          adoptBitmap(bitmap);
        })
        .catch((error) => {
          if (cancelled) return;
          if (error?.message !== "cancelled") {
            console.warn("[CanvasSafety] createImageBitmap decode failed, falling back:", error);
          }
          loadViaImageElement();
        });
    } else {
      loadViaImageElement();
    }

    return () => {
      cancelled = true;
    };
  }, [src, meta?.width, meta?.height]);

  // Releases whatever ImageBitmap is currently held the moment this node
  // unmounts (item deleted, asset swapped to a non-bitmap source, etc.) —
  // adoptBitmap already closes the previous one on every ordinary swap,
  // this is only for the final one no future adoptBitmap call will close.
  useEffect(() => {
    return () => {
      if (activeBitmapRef.current) {
        activeBitmapRef.current.close();
        activeBitmapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!baseImage) {
      setRenderedImage(null);
      return;
    }

    if (!flipX && !flipY) {
      setRenderedImage(baseImage);
      return;
    }

    const width = baseImage.naturalWidth || baseImage.width;
    const height = baseImage.naturalHeight || baseImage.height;

    let canvas = flippedCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      flippedCanvasRef.current = canvas;
    }
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(flipX ? -1 : 1, 0, 0, flipY ? -1 : 1, flipX ? width : 0, flipY ? height : 0);
    ctx.drawImage(baseImage, 0, 0, width, height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    setRenderedImage(canvas);
  }, [baseImage, flipX, flipY]);

  return {
    image: renderedImage,
    naturalWidth: baseImage?.naturalWidth || baseImage?.width || 0,
    naturalHeight: baseImage?.naturalHeight || baseImage?.height || 0,
  };
}
