// Génère les icônes PWA / stores depuis le capybara du jeu : `node scripts/make-icons.mjs`
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "public/assets/images/characters/animals/capybara.png");
const out = path.join(root, "public/icons");

const background = (size, solid) => solid ? `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="${solid}"/></svg>` : `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2d0d66"/><stop offset="1" stop-color="#1c0840"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.45" r="0.5">
      <stop offset="0" stop-color="#ffc800" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#ffc800" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100" height="100" fill="url(#bg)"/>
  <rect width="100" height="100" fill="url(#glow)"/>
</svg>`;

// Loupe dorée, verre légèrement teinté, manche violet
const loupe = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <g transform="rotate(-40 50 50)">
    <rect x="44" y="62" width="12" height="34" rx="6" fill="#8739f9" stroke="#1c0840" stroke-width="3"/>
    <rect x="46" y="56" width="8" height="10" fill="#c98a00" stroke="#1c0840" stroke-width="2"/>
    <circle cx="50" cy="34" r="27" fill="#bfe6ff" fill-opacity="0.35" stroke="#1c0840" stroke-width="13"/>
    <circle cx="50" cy="34" r="27" fill="none" stroke="#ffc800" stroke-width="8"/>
    <path d="M36 24 A18 18 0 0 1 52 15" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
  </g>
</svg>`;

// scale : part de l'icône occupée par le dessin (zone sûre réduite pour maskable)
// solid : couleur unie ("transparent" possible) à la place du dégradé
async function makeIcon(size, file, { scale = 0.78, solid, dir = out } = {}) {
  const art = Math.round(size * scale);
  const capy = Math.round(art * 0.78);
  const lens = Math.round(art * 0.55);
  const offset = Math.round((size - art) / 2);

  const layers = [];
  if (art > 0) {
    const capyBuf = await sharp(src).resize(capy, capy).toBuffer();
    const loupeBuf = await sharp(Buffer.from(loupe(lens))).png().toBuffer();
    layers.push(
      { input: capyBuf, left: offset, top: offset + Math.round(art * 0.04) },
      { input: loupeBuf, left: offset + art - lens, top: offset + art - lens },
    );
  }

  await sharp(Buffer.from(background(size, solid)))
    .composite(layers)
    // palette sur les splash (grand fond uni) : fichiers bien plus légers
    .png({ compressionLevel: 9, palette: size > 1024 })
    .toFile(path.join(dir, file));
  console.log("✓", path.relative(root, path.join(dir, file)));
}

await mkdir(out, { recursive: true });
await makeIcon(192, "icon-192.png");
await makeIcon(512, "icon-512.png");
await makeIcon(512, "icon-maskable-512.png", { scale: 0.62 });
await makeIcon(180, "apple-touch-icon.png");
await makeIcon(64, "favicon-64.png", { scale: 0.9 });
// Sources des icônes et splash natifs pour `npx @capacitor/assets generate` (hors public/)
const res = path.join(root, "resources");
await mkdir(res, { recursive: true });
await makeIcon(1024, "icon-only.png", { scale: 0.62, dir: res });
await makeIcon(1024, "icon-foreground.png", { scale: 0.6, solid: "transparent", dir: res });
await makeIcon(1024, "icon-background.png", { scale: 0, dir: res });
await makeIcon(2732, "splash.png", { scale: 0.3, solid: "#2d0d66", dir: res });
await makeIcon(2732, "splash-dark.png", { scale: 0.3, solid: "#1c0840", dir: res });
