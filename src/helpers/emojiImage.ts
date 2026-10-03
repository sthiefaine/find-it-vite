// Dessine un emoji sur un canvas et renvoie une image PNG (data URL), avec cache.
const SIZE = 128;
const FONT = '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", "Twemoji Mozilla", sans-serif';
const cache = new Map<string, string>();

export function emojiImage(emoji: string): string {
  const hit = cache.get(emoji);
  if (hit !== undefined) return hit;
  // hors navigateur (tests) : rien à dessiner
  if (typeof document === "undefined") return "";
  let url = "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.font = `${Math.round(SIZE * 0.8)}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    // centrage sur la boîte réelle du glyphe (la ligne de base varie selon les polices)
    const m = ctx.measureText(emoji);
    const ascent = m.actualBoundingBoxAscent || SIZE * 0.7;
    const descent = m.actualBoundingBoxDescent || SIZE * 0.1;
    const left = m.actualBoundingBoxLeft;
    const right = m.actualBoundingBoxRight;
    const dx = left || right ? (left - right) / 2 : 0;
    ctx.fillText(emoji, SIZE / 2 + dx, SIZE / 2 + (ascent - descent) / 2);
    url = canvas.toDataURL("image/png");
  } catch {
    return "";
  }
  cache.set(emoji, url);
  return url;
}
