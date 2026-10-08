import type { Layout } from "../engine/types";

export const CONTRACTS = [
  { id: "precise-5", title: "Précision", kind: "precise", target: 5, reward: 3 },
  { id: "precise-10", title: "Précision", kind: "precise", target: 10, reward: 5 },
  { id: "quick-3", title: "Rapidité", kind: "quick", target: 3, reward: 3 },
  { id: "quick-5", title: "Rapidité", kind: "quick", target: 5, reward: 5 },
  { id: "moving-5", title: "En mouvement", kind: "moving", target: 5, reward: 3 },
  { id: "moving-10", title: "En mouvement", kind: "moving", target: 10, reward: 5 },
] as const;
export type Contract = typeof CONTRACTS[number];
export type ContractId = Contract["id"];
export type ContractRun = { id: ContractId; progress: number; complete: boolean; bonus: number };
export type ContractEvent = { type: "miss" } | { type: "found"; layout: Layout; elapsedMs: number | null };
export const getContract = (id: unknown): Contract | undefined => CONTRACTS.find(contract => contract.id === id);

export const contractDescription = (contract: Contract) => contract.kind === "precise"
  ? "{{count}} portraits d’affilée sans erreur."
  : contract.kind === "quick" ? "{{count}} portraits d’affilée en moins de 5 secondes chacun."
    : "{{count}} portraits sur des grilles mobiles dans une partie.";

export function advanceContract(run: ContractRun, event: ContractEvent): ContractRun {
  if (run.complete) return run;
  const contract = getContract(run.id)!;
  let progress = run.progress;
  if (event.type === "miss") {
    if (contract.kind !== "moving") progress = 0;
  } else if (contract.kind === "precise") progress++;
  else if (contract.kind === "moving") progress += Number(event.layout === "scroll" || event.layout === "swarm");
  else progress = event.elapsedMs !== null && event.elapsedMs >= 0 && event.elapsedMs < 5_000 ? progress + 1 : 0;
  progress = Math.min(contract.target, progress);
  return { ...run, progress, complete: progress === contract.target };
}
