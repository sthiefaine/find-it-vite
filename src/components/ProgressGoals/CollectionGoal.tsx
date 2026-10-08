import { Link } from "react-router-dom";
import { useTranslation } from "../../i18n";
import { historyPack, peoplePack } from "../../helpers/characters";
import { PERSON_PRICE } from "../../content/personUnlocks";
import { portraitStyle } from "../../helpers/portraitScale";
import { albumCharacterLabel } from "../../pages/Album/albumNames";
import { useSaveStore } from "../../save/saveStore";
import "./ProgressGoals.css";

export function CollectionGoal({ prompt = false }: { prompt?: boolean }) {
  const { locale, t: tr } = useTranslation();
  const save = useSaveStore(state => state.save);
  const person = [...historyPack, ...peoplePack].find(person => person.name === save.goals.person);
  if (!person) return prompt ? <Link className="collection-goal-prompt" to="/album?collection=histoire">{tr("Choisir mon prochain personnage")} →</Link> : null;
  const progress = Math.min(save.wallet.stars, PERSON_PRICE);
  return <Link className="collection-goal" to={`/album?person=${encodeURIComponent(person.name)}`}>
    <img src={person.imageSrc} alt="" width={48} height={48} style={portraitStyle(person.imageSrc)} />
    <span className="collection-goal-copy">
      <small>{tr("Mon prochain personnage")}</small>
      <strong>{tr("{{count}}/{{price}} étoiles pour {{name}}", { count: progress, price: PERSON_PRICE, name: albumCharacterLabel(person, locale) })}</strong>
      <progress max={PERSON_PRICE} value={progress} aria-label={tr("Progression vers le prochain personnage")} />
      <small>{progress === PERSON_PRICE ? tr("Prêt à débloquer !") : tr("Encore {{count}} étoiles à gagner", { count: PERSON_PRICE - progress })}</small>
    </span>
    <span aria-hidden="true">→</span>
  </Link>;
}
