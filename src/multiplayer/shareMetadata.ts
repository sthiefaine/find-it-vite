import { ROOM_CODE_PATTERN } from "./protocol";

export const SHARE_IMAGE = "/social/find-it-duel.jpg";
const START = "<!-- find-it-social -->";
const END = "<!-- /find-it-social -->";
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function publicOrigin(value: string): string {
  try { const url = new URL(value); return ["https:", "http:"].includes(url.protocol) ? url.origin : ""; }
  catch { return ""; }
}

export function shareMetadata(origin: string, requestPath = "/") {
  const base = publicOrigin(origin);
  const request = new URL(requestPath, base || "https://find-it.invalid");
  const duel = request.pathname === "/multiplayer";
  const code = request.searchParams.get("room")?.toUpperCase() ?? "";
  const room = duel && ROOM_CODE_PATTERN.test(code) ? code : "";
  const path = duel ? `/multiplayer${room ? `?room=${room}` : ""}` : "/";
  return {
    title: duel ? room ? `Un duel sur Find It ? · Salon ${room}` : "Un duel sur Find It ?" : "Find It · Qui se cache dans la foule ?",
    description: duel ? "Rejoins mon duel ! La même foule, deux joueurs : trouve la cible le premier. 3 vies, 60 secondes et 2 secondes gagnées par bonne réponse."
      : "Retrouve animaux, personnalités et drapeaux parmi la foule. Explore l’aventure ou défie un ami en ligne !",
    url: base + path, image: base + SHARE_IMAGE,
  };
}

// Les aperçus sont présents dans la réponse HTML, avant toute exécution React.
// Seul le code public du salon apparaît : jamais les jetons ou les pseudos.
export function decorateShareHtml(html: string, origin: string, requestPath = "/"): string {
  const meta = shareMetadata(origin, requestPath);
  const tags = [
    ['name', 'description', meta.description], ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'Find It'], ['property', 'og:locale', 'fr_FR'],
    ['property', 'og:title', meta.title], ['property', 'og:description', meta.description],
    ['property', 'og:url', meta.url], ['property', 'og:image', meta.image],
    ['property', 'og:image:type', 'image/jpeg'], ['property', 'og:image:width', '1200'],
    ['property', 'og:image:height', '630'], ['property', 'og:image:alt', 'Find It : un duel d’observation entre amis'],
    ['name', 'twitter:card', 'summary_large_image'], ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description], ['name', 'twitter:image', meta.image],
    ['name', 'twitter:image:alt', 'Find It : un duel d’observation entre amis'],
  ].map(([attribute, name, content]) => `<meta ${attribute}="${name}" content="${escape(content)}" />`).join("\n    ");
  const block = `${START}\n    ${tags}\n    <link rel="canonical" href="${escape(meta.url)}" />\n    ${END}`;
  let next = html.replace(/<title>[^<]*<\/title>/, `<title>${escape(meta.title)}</title>`);
  if (next.includes(START)) return next.replace(new RegExp(`${START}[\\s\\S]*?${END}`), block);
  next = next.replace(/<meta\s+name="description"[^>]*\/?>(\r?\n)?/g, "");
  return next.replace("</head>", `    ${block}\n  </head>`);
}
