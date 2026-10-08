import { useTranslation } from "../../i18n";
import { CONTRACTS, contractDescription, getContract } from "../../game/contracts";
import { useSaveStore } from "../../save/saveStore";
import "./ProgressGoals.css";

export function ContractPicker() {
  const { t: tr } = useTranslation();
  const save = useSaveStore(state => state.save);
  const loaded = useSaveStore(state => state.loaded);
  const readOnly = useSaveStore(state => state.readOnly);
  const select = useSaveStore(state => state.selectContract);
  const selected = getContract(save.goals.contract);
  return <details className="contract-picker">
    <summary>{tr("Contrat facultatif")} · {selected ? `${tr(selected.title)} +${selected.reward} ★` : tr("Sans contrat")}</summary>
    <p>{tr("Une prime par contrat. Choisis avant une partie solo ; la progression repart à zéro à chaque partie.")}</p>
    <div className="contract-options" role="group" aria-label={tr("Contrat facultatif")}>
      <button type="button" aria-pressed={!selected} disabled={!loaded || readOnly} onClick={() => select(null)}>{tr("Sans contrat")}</button>
      {CONTRACTS.map(contract => {
        const completed = save.goals.completedContracts.includes(contract.id);
        return <button key={contract.id} type="button" disabled={!loaded || readOnly || completed}
          aria-pressed={selected?.id === contract.id} onClick={() => select(contract.id)}>
          <strong>{tr(contract.title)} · {completed ? tr("Réussi") : `+${contract.reward} ★`}</strong>
          <span>{tr(contractDescription(contract), { count: contract.target })}</span>
        </button>;
      })}
    </div>
  </details>;
}
