export type ImageViewport = { scale: number; x: number; y: number };
export type ImageBounds = { width: number; height: number; imageWidth: number; imageHeight: number };
export type ImagePoint = { x: number; y: number };
export const fittedViewport: ImageViewport = { scale: 1, x: 0, y: 0 };

export function constrainViewport(view: ImageViewport, bounds: ImageBounds): ImageViewport {
  const scale = Math.min(5, Math.max(1, Number.isFinite(view.scale) ? view.scale : 1));
  if (scale <= 1.01) return { ...fittedViewport };
  const limitX = Math.max(0, (bounds.imageWidth * scale - bounds.width) / 2);
  const limitY = Math.max(0, (bounds.imageHeight * scale - bounds.height) / 2);
  return { scale, x: Math.min(limitX, Math.max(-limitX, view.x)), y: Math.min(limitY, Math.max(-limitY, view.y)) };
}

/** Keep the image point beneath the pinch centre or mouse cursor in place while zooming. */
export function zoomViewport(view: ImageViewport, scale: number, origin: ImagePoint, target: ImagePoint, bounds: ImageBounds): ImageViewport {
  const nextScale = Math.min(5, Math.max(1, scale));
  const ratio = nextScale / view.scale;
  return constrainViewport({ scale: nextScale, x: target.x - (origin.x - view.x) * ratio, y: target.y - (origin.y - view.y) * ratio }, bounds);
}
