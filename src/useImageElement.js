import { useEffect, useRef, useState } from "react";

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
// Only safe while sources are same-origin data URLs (true today, since
// uploads go through FileReader.readAsDataURL) — a remote http(s) image
// source would taint this canvas and break toDataURL()-based export.
export function useImageElement(src, { flipX = false, flipY = false } = {}) {
  const [baseImage, setBaseImage] = useState(null);
  const [renderedImage, setRenderedImage] = useState(null);
  const flippedCanvasRef = useRef(null);

  useEffect(() => {
    if (!src) {
      setBaseImage(null);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setBaseImage(img);
    img.onerror = () => setBaseImage(null);
    img.src = src;
  }, [src]);

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
