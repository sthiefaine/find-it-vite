// Message court sous « Bravo ! », selon le score
export function scoreMessage(score: number): string {
  if (score <= 0) return "Tu vas y arriver !";
  if (score < 5) return "Bien joué !";
  if (score < 10) return "Super !";
  if (score < 20) return "Génial !";
  return "Incroyable !";
}

// 830 → « 0,8 s »
export function formatSeconds(ms: number | null): string {
  if (ms === null) return "–";
  const seconds = (ms / 1000).toLocaleString("fr-FR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${seconds} s`;
}

// Aventure : « 7 étapes · 🦁 → 🐳 » ; aucune étape : encourageant, jamais culpabilisant
export function adventureRunMessage(run: { stepsCleared: number; phases: readonly string[] }): string {
  if (run.stepsCleared <= 0) return frenchSpacing("Tu vas y arriver !");
  const steps = `${run.stepsCleared} étape${run.stepsCleared > 1 ? "s" : ""} franchie${run.stepsCleared > 1 ? "s" : ""}`;
  const trip = run.phases.map(phaseEmoji).join(" → ");
  return frenchSpacing(trip ? `${steps} · ${trip}` : steps);
}

const PHASE_EMOJI: Record<string, string> = {
  animaux: "🦁",
  ocean: "🐳",
  dinos: "🦖",
  halloween: "🎃",
  espace: "🚀",
  melange: "🌈",
};
const phaseEmoji = (phase: string) => PHASE_EMOJI[phase] ?? "";

// Typographie française : espace insécable avant ! ? : ; pour que la ponctuation
// ne parte jamais seule à la ligne sur petit écran
export function frenchSpacing(text: string): string {
  return text.replace(/ ([!?:;])/g, "\u00a0$1");
}

// Titre de l'écran de fin, toujours encourageant
export function resultsTitle(
  mode: "endless" | "daily" | "adventure",
  { won, score, dailyLabel }: { won: boolean; score: number; dailyLabel: string }
): string {
  if (mode === "adventure") return frenchSpacing(won ? "Bravo !" : "Encore un essai !");
  if (mode === "daily") return frenchSpacing(dailyLabel);
  return frenchSpacing(score > 0 ? "Bravo !" : "Presque !");
}
