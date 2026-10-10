import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

// Les originaux restent éditables en PNG512 ; le jeu utilise un dérivé alpha256.
const hash = bytes => createHash('sha256').update(bytes).digest('hex').slice(0, 12);
const packs = await Promise.all(['Animals', 'People', 'History', 'Celebrities'].map(async name =>
  JSON.parse(await fs.readFile(`src/content/published${name}.json`, 'utf8'))));
const variants = {};
let previous = {};
try { previous = JSON.parse(await fs.readFile('src/content/portraitVariants.json', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
let originalsBytes = 0, gameBytes = 0;
for (const portrait of packs.flat()) {
  const source = portrait.imageSrc;
  if (!/^\/assets\/images\/characters\/(animals|people|history|celebrities)\/[a-z0-9-]+\.png$/.test(source)) throw new Error(`Source invalide : ${source}`);
  const original = await fs.readFile(`public${source}`);
  originalsBytes += original.length;
  const revision = hash(original);
  const cached = previous[source];
  if (cached?.revision === revision) {
    try {
      const stat = await fs.stat(`public${cached.gameSrc}`);
      variants[source] = cached;
      gameBytes += stat.size;
      continue;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  const metadata = await sharp(original).metadata();
  if (!metadata.hasAlpha) throw new Error(`Canal alpha absent : ${source}`);
  const game = await sharp(original).resize(256, 256, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, alphaQuality: 100, effort: 5 }).toBuffer();
  const gameSrc = source.replace(/\.png$/, `.${hash(game)}.webp`);
  await fs.writeFile(`public${gameSrc}`, game);
  variants[source] = { gameSrc, revision };
  gameBytes += game.length;
}
// Le manifeste est écrit seulement une fois tous les dérivés prêts.
const manifestPath = 'src/content/portraitVariants.json';
await fs.writeFile(`${manifestPath}.tmp`, `${JSON.stringify(variants, null, 2)}\n`);
await fs.rename(`${manifestPath}.tmp`, manifestPath);
// Éviter d'accumuler d'anciens dérivés après la régénération d'un portrait.
const current = new Set(Object.values(variants).map(variant => variant.gameSrc));
for (const directory of ['animals', 'people', 'history', 'celebrities']) {
  const root = `public/assets/images/characters/${directory}`;
  for (const file of await fs.readdir(root)) if (/\.[a-f0-9]{12}\.webp$/.test(file) && !current.has(`/assets/images/characters/${directory}/${file}`)) await fs.unlink(path.join(root, file));
}
console.log(JSON.stringify({ portraits: Object.keys(variants).length, originalsBytes, gameBytes, reduction: `${(100 * (1 - gameBytes / originalsBytes)).toFixed(1)}%` }));
