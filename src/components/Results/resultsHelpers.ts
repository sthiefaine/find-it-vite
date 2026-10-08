import { translate as tr } from "../../i18n";
import { localeTag } from "../../i18n/locales";
import { useLanguageStore } from "../../i18n/store";
// Message court sous « Bravo ! », selon le score
export function scoreMessage(score: number): string {
  if (score <= 0) return tr("Tu vas y arriver !");
  if (score < 5) return tr("Bien joué !");
  if (score < 10) return tr("Super !");
  if (score < 20) return tr("Génial !");
  return tr("Incroyable !");
}

// 830 → « 0,8 s »
export function formatSeconds(ms: number | null): string {
  if (ms === null) return "–";
  const seconds = (ms / 1000).toLocaleString(localeTag(useLanguageStore.getState().locale), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${seconds} s`;
}

// Aventure : « 7 étapes · 🦁 → 🐳 » ; aucune étape : encourageant, jamais culpabilisant
export function adventureRunMessage(run: { stepsCleared: number; phases: readonly string[] }): string {
  if (run.stepsCleared <= 0) return frenchSpacing(tr("Tu vas y arriver !"));
  const steps = tr("{{count}} étapes franchies", { count: run.stepsCleared });
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
  return useLanguageStore.getState().locale === "fr" ? text.replace(/ ([!?:;])/g, "\u00a0$1") : text;
}

// Titre de l'écran de fin, toujours encourageant
export function resultsTitle(
  mode: "endless" | "daily" | "adventure",
  { won, score, dailyLabel }: { won: boolean; score: number; dailyLabel: string }
): string {
  if (mode === "adventure") return frenchSpacing(won ? tr("Bravo !") : tr("Encore un essai !"));
  if (mode === "daily") return frenchSpacing(dailyLabel);
  return frenchSpacing(score > 0 ? tr("Bravo !") : tr("Presque !"));
}
