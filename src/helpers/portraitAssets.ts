import variants from "../content/portraitVariants.json";

const manifest: Readonly<Record<string, { gameSrc: string; revision: string }>> = variants;
export function portraitGameSource(source: string): string {
  return manifest[source]?.gameSrc ?? source;
}
export function portraitDetailSource(portrait: { imageSrc: string; detailImageSrc?: string }): string {
  const original = portrait.detailImageSrc;
  const revision = original && manifest[original]?.revision;
  return original ? `${original}${revision ? `?v=${revision}` : ""}` : portrait.imageSrc;
}
