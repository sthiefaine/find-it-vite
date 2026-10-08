import { useGameStore } from "../../../store/store";
import { useTranslation } from "../../i18n";
import { contractDescription, getContract, type ContractRun } from "../../game/contracts";
import "./ProgressGoals.css";

export function ContractSummary({ run }: { run: ContractRun | null }) {
  const { t: tr } = useTranslation();
  const contract = getContract(run?.id);
  if (!run || !contract) return null;
  return <div className={`contract-progress${run.complete ? " is-complete" : ""}`} role="status">
    <strong>{tr(contract.title)} · {run.complete ? tr("Réussi") : `${run.progress}/${contract.target}`}{run.bonus > 0 ? ` +${run.bonus} ★` : ""}</strong>
    <span>{tr(contractDescription(contract), { count: contract.target })}</span>
  </div>;
}

export function ContractProgress() {
  const run = useGameStore(state => state.contractRun);
  return <ContractSummary run={run} />;
}
