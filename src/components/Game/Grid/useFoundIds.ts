import { useMemo } from "react";
import { useGameStore } from "../../../../store/store";

// Ids des cibles déjà trouvées dans le niveau (contrat du store, voir useCharacterInteraction)
const NONE: number[] = [];
export function useFoundIds(): Set<number> {
  const ids = useGameStore((s) =>
    "foundIds" in s ? ((s.foundIds as number[] | undefined) ?? NONE) : NONE
  );
  return useMemo(() => new Set(ids), [ids]);
}
