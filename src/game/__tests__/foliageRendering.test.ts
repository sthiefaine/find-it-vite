import { describe, expect, it, vi } from "vitest";
import { paintFoliageCanvases } from "../foliageRendering";

function canvas(size = 0, available = true) {
  const alpha = new Uint8ClampedArray([0, 0, 0, 255]);
  const context = { drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: alpha })) };
  const element = { width: size, height: size, getContext: vi.fn(() => available ? context : null) };
  return { element: element as unknown as HTMLCanvasElement, context, alpha };
}

describe("première peinture des feuillages", () => {
  it("dessine tous les bouquets et le masque immédiatement depuis la même image décodée", () => {
    const image = { naturalWidth: 1254 } as HTMLImageElement;
    const first = canvas();
    const second = canvas();
    const mask = canvas(128);

    // Ce retour synchrone autorise le layout effect à révéler le calque :
    // aucune attente d'un nouvel élément Image, decode ou requestAnimationFrame.
    const alpha = paintFoliageCanvases(image, [
      { canvas: first.element, size: 144 }, { canvas: second.element, size: 156 },
    ], mask.element, 2);

    expect(alpha).toBe(mask.alpha);
    expect(first.context.drawImage).toHaveBeenCalledWith(image, 0, 0, 288, 288);
    expect(second.context.drawImage).toHaveBeenCalledWith(image, 0, 0, 312, 312);
    expect(mask.context.drawImage).toHaveBeenCalledWith(image, 0, 0, 128, 128);
    expect(mask.context.getImageData).toHaveBeenCalledWith(0, 0, 128, 128);
    expect(first.element.width).toBe(288);
    expect(first.element.height).toBe(288);
  });

  it("garde le calque non prêt si un bouquet ne peut pas être dessiné", () => {
    const image = { naturalWidth: 1254 } as HTMLImageElement;
    const first = canvas();
    const missing = canvas(0, false);
    const mask = canvas(128);
    expect(paintFoliageCanvases(image, [
      { canvas: first.element, size: 144 }, { canvas: missing.element, size: 156 },
    ], mask.element, 2)).toBeNull();
    expect(first.context.drawImage).not.toHaveBeenCalled();
    expect(mask.context.getImageData).not.toHaveBeenCalled();
  });

  it("limite le raster au PNG source sur écran à très haute densité", () => {
    const image = { naturalWidth: 1254 } as HTMLImageElement;
    const patch = canvas();
    const mask = canvas(128);
    paintFoliageCanvases(image, [{ canvas: patch.element, size: 156 }], mask.element, 10);
    expect(patch.element.width).toBe(1254);
    expect(patch.context.drawImage).toHaveBeenCalledWith(image, 0, 0, 1254, 1254);
  });
});
