// Où mène le bouton retour, et le titre affiché dans l'en-tête
export function backTarget(pathname: string, search: string): string {
  if (pathname === "/game" && new URLSearchParams(search).get("mode") === "adventure") {
    return "/adventure";
  }
  return "/";
}

const TITLES: Record<string, string> = {
  "/adventure": "Aventure",
  "/album": "Album",
  "/options": "Options",
  "/duel": "Duel",
};

export function headerTitle(pathname: string): string | null {
  return TITLES[pathname] ?? null;
}

// Pages où le total d'étoiles est utile
export function showsStars(pathname: string): boolean {
  return pathname === "/adventure" || pathname === "/options";
}
