// Le feuillage est dessiné depuis l'image déjà décodée du niveau. Remonter des
// <img> avec la même URL ne garantit pas leur peinture dès la première frame.
// Le masque et les bouquets sont prêts ensemble, avant de révéler le calque.
export function paintFoliageCanvases(
  image: HTMLImageElement,
  patches: readonly { canvas: HTMLCanvasElement; size: number }[],
  mask: HTMLCanvasElement,
  resolution: number,
): Uint8ClampedArray | null {
  const maskContext = mask.getContext("2d", { willReadFrequently: true });
  const contexts = patches.map(patch => patch.canvas.getContext("2d"));
  if (!maskContext || contexts.some(context => !context)) return null;

  patches.forEach(({ canvas, size }, index) => {
    // Rasteriser à la taille affichée plutôt qu'au PNG source (1254 × 1254).
    const pixels = Math.max(1, Math.min(image.naturalWidth, Math.ceil(size * resolution)));
    canvas.width = pixels;
    canvas.height = pixels;
    contexts[index]!.drawImage(image, 0, 0, pixels, pixels);
  });
  maskContext.drawImage(image, 0, 0, mask.width, mask.height);
  return maskContext.getImageData(0, 0, mask.width, mask.height).data;
}
