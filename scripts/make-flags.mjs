// Offline, reproducible flag sprites: node scripts/make-flags.mjs [--check]
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "content/flags/svg");
const outputDir = path.join(root, "public/assets/images/characters/flags");
const cataloguePath = path.join(root, "src/content/publishedFlags.json");
const duplicatePath = path.join(root, "content/flags/visual-duplicates.json");
const countries = JSON.parse(await readFile(path.join(root, "content/flags/countries.json"), "utf8"));
const check = process.argv.includes("--check");
assert(process.argv.slice(2).every((arg) => arg === "--check"), "Only --check is supported");
const size = 512;
const margin = 32;
const artSize = size - margin * 2;
const hash = (input) => createHash("sha256").update(input).digest("hex");
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

assert.equal(countries.length, 250, "Expected 249 ISO 3166-1 entries and Kosovo");
assert.equal(new Set(countries.map(({ countryCode }) => countryCode)).size, countries.length);
assert(countries.some(({ countryCode }) => countryCode === "XK"));
assert(countries.every(({ countryCode, label }) => /^[A-Z]{2}$/.test(countryCode) && label));
const expectedFiles = countries.map(({ countryCode }) => `${countryCode.toLowerCase()}.svg`).sort();
assert.deepEqual((await readdir(sourceDir)).filter((file) => file.endsWith(".svg")).sort(), expectedFiles);

function svgCanvas(source, code) {
  // Do not normalize flags to 4:3, crop them, or fill transparent areas (Nepal).
  const svg = source.replace(/<\?xml[^>]*\?>/g, "").replace(/<!DOCTYPE[^>]*>/g, "").trim();
  const opening = svg.match(/<svg\b[^>]*>/)?.[0];
  assert(opening, `${code}: missing SVG root`);
  assert(!/(?:href\s*=\s*["'](?:https?:|file:|data:)|url\s*\(\s*["']?(?:https?:|file:|data:))/i.test(svg), `${code}: external SVG dependency`);
  const viewBox = opening.match(/\bviewBox\s*=\s*["']([^"']+)["']/)?.[1];
  let box;
  if (viewBox) box = viewBox.split(/[\s,]+/).map(Number);
  else {
    const width = Number.parseFloat(opening.match(/\bwidth\s*=\s*["']([^"']+)["']/)?.[1]);
    const height = Number.parseFloat(opening.match(/\bheight\s*=\s*["']([^"']+)["']/)?.[1]);
    box = [0, 0, width, height];
  }
  assert(box.length === 4 && box.every(Number.isFinite) && box[2] > 0 && box[3] > 0, `${code}: invalid dimensions`);
  const scale = artSize / Math.max(box[2], box[3]);
  const width = box[2] * scale;
  const height = box[3] * scale;
  const attributes = opening.slice(4, -1).replace(/\s(?:width|height|x|y|viewBox|preserveAspectRatio)\s*=\s*["'][^"']*["']/g, "");
  const nested = `<svg${attributes} x="${(size - width) / 2}" y="${(size - height) / 2}" width="${width}" height="${height}" viewBox="${box.join(" ")}" preserveAspectRatio="xMidYMid meet">`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${svg.replace(opening, nested)}</svg>`);
}

function colorName(r, g, b) {
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  const saturation = maximum === 0 ? 0 : delta / maximum;
  if (maximum < 48) return "black";
  if (saturation < 0.13) return maximum > 214 ? "white" : "grey";
  let hue = maximum === r ? (g - b) / delta : maximum === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  if (hue < 23 || hue >= 345) return "red";
  if (hue < 43) return maximum < 170 ? "brown" : "orange";
  if (hue < 72) return "yellow";
  if (hue < 170) return "green";
  if (hue < 265) return "blue";
  if (hue < 295) return "purple";
  return "pink";
}

function dominantColors(pixels) {
  const counts = new Map();
  let total = 0;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    if (pixels[offset + 3] < 245) continue;
    const color = colorName(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
    counts.set(color, (counts.get(color) ?? 0) + 1);
    total += 1;
  }
  assert(total > 0, "Empty flag");
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "en"))
    .filter(([, count]) => count / total >= 0.025).map(([color]) => color);
}

async function generate(country) {
  const code = country.countryCode.toLowerCase();
  const source = await readFile(path.join(sourceDir, `${code}.svg`));
  assert.equal(hash(source), country.sourceSha256, `${code}: source changed; review and update countries.json`);
  // Render vectors at 2x before downsampling; tiny heraldic details stay legible.
  const pixels = await sharp(svgCanvas(source.toString("utf8"), code), { density: 144 })
    .resize(size, size).ensureAlpha().raw().toBuffer();
  const png = await sharp(pixels, { raw: { width: size, height: size, channels: 4 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  const target = path.join(outputDir, `${code}.png`);
  if (check) {
    const existing = await sharp(await readFile(target)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(existing.info.width, size, `${code}: width`);
    assert.equal(existing.info.height, size, `${code}: height`);
    assert(pixels.equals(existing.data), `${code}: PNG differs from its source`);
  } else await writeFile(target, png);
  for (let i = 0; i < size; i += 1) {
    assert.equal(pixels[(i * size) * 4 + 3], 0, `${code}: left margin`);
    assert.equal(pixels[(i * size + size - 1) * 4 + 3], 0, `${code}: right margin`);
    assert.equal(pixels[i * 4 + 3], 0, `${code}: top margin`);
    assert.equal(pixels[((size - 1) * size + i) * 4 + 3], 0, `${code}: bottom margin`);
  }
  const colors = dominantColors(pixels);
  return {
    catalogue: {
      name: `flag-${code}`, label: country.label,
      imageSrc: `/assets/images/characters/flags/${code}.png`, serie: "flags",
      color: colors[0], family: country.family, dominantColors: colors,
      tags: ["drapeaux", country.family.replace("flags-", ""), code],
      countryCode: country.countryCode,
    },
    pixelHash: hash(pixels),
    bytes: png.length,
  };
}

if (!check) await mkdir(outputDir, { recursive: true });
const rendered = [];
for (let offset = 0; offset < countries.length; offset += 4) {
  rendered.push(...await Promise.all(countries.slice(offset, offset + 4).map(generate)));
}

const groups = new Map();
for (const flag of rendered) {
  const group = groups.get(flag.pixelHash) ?? [];
  group.push(flag.catalogue);
  groups.set(flag.pixelHash, group);
}
const preferredRepresentatives = ["FR", "NO", "US", "AU", "NL", "GB"];
const duplicates = [];
for (const [pixelHash, group] of groups) {
  if (group.length < 2) continue;
  const representative = preferredRepresentatives.map((code) => group.find(({ countryCode }) => countryCode === code)).find(Boolean) ?? group[0];
  for (const flag of group) {
    flag.family = representative.family;
    flag.tags = ["drapeaux", representative.family.replace("flags-", ""), flag.countryCode.toLowerCase()];
    if (flag !== representative) flag.duplicateOf = representative.name;
  }
  duplicates.push({ representative: representative.name, members: group.map(({ name }) => name), pixelSha256: pixelHash });
}
const catalogue = rendered.map(({ catalogue: entry }) => entry);
const expectedPngs = expectedFiles.map((file) => file.replace(/\.svg$/, ".png"));
assert.deepEqual((await readdir(outputDir)).filter((file) => file.endsWith(".png")).sort(), expectedPngs);
if (check) {
  assert.equal(await readFile(cataloguePath, "utf8"), json(catalogue), "Published catalogue is stale");
  assert.equal(await readFile(duplicatePath, "utf8"), json(duplicates), "Duplicate report is stale");
} else {
  await writeFile(cataloguePath, json(catalogue));
  await writeFile(duplicatePath, json(duplicates));
}
console.log(`${check ? "Verified" : "Generated"} ${catalogue.length} flags, ${size}×${size} RGBA, ${new Set(catalogue.map(({ family }) => family)).size} visual families, ${duplicates.length} identical groups, ${(rendered.reduce((sum, { bytes }) => sum + bytes, 0) / 1024 / 1024).toFixed(2)} MiB PNG.`);
for (const { representative, members } of duplicates) console.log(`${representative}: ${members.join(", ")}`);
