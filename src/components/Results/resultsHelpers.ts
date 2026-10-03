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
