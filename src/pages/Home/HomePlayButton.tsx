import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { ButtonXL } from "../../components/Buttons/ButtonXL";
import { GameIcon } from "../../components/Icons/GameIcon";
import { useTranslation } from "../../i18n";
import { isNative } from "../../platform/native";
import { applyWebUpdate, useWebUpdateStore } from "../../platform/webUpdates";
import { useSaveStore } from "../../save/saveStore";

export function HomePlayButton() {
  const { t: tr } = useTranslation();
  const available = useWebUpdateStore((state) => state.available);
  const loaded = useSaveStore((state) => state.loaded);
  const [updating, setUpdating] = useState(false);
  const update = available && !isNative();

  const apply = async () => {
    setUpdating(true);
    try {
      await applyWebUpdate(useWebUpdateStore.getState().status !== "ready");
    } finally {
      setUpdating(false);
    }
  };

  return <ButtonXL
    text={tr(updating ? "Mise à jour…" : update ? "Mettre à jour" : "Jouer")}
    link={update ? undefined : "/adventure"}
    onClick={update ? () => { void apply(); } : undefined}
    disabled={updating || (update && !loaded)}
    busy={updating}
    variant="bling"
  >
    {update ? <RefreshCw className="game-icon" /> : <GameIcon name="play" />}
  </ButtonXL>;
}
