// 2 → « ★★☆ »
export function starsText(stars: number): string {
  const n = Math.max(0, Math.min(3, Math.floor(stars)));
  return "★".repeat(n) + "☆".repeat(3 - n);
}
