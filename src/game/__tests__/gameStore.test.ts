import { beforeEach, describe, expect, it, vi } from "vitest";
import { GameStateEnum, useGameStore } from "../../../store/store";
import { useSaveStore } from "../../save/saveStore";
import { defaultSave } from "../../save/schema";
import { generateLevel } from "../../engine";
import { charactersDetails } from "../../helpers/characters";
import { mechanicsOf } from "../../engine/rules";

const spec = generateLevel(1, { seed: 7, tier: "normal", pool: charactersDetails });

beforeEach(() => {
  useSaveStore.setState({ save: defaultSave(), loaded: true, readOnly: false });
  useGameStore.getState().setClearGameStore();
});

describe("submitGameResult", () => {
  it("le Défi du jour ne touche pas au record Infini", () => {
    const save = useSaveStore.getState();
    const recordGame = vi.spyOn(save, "recordGame");
    useGameStore.getState().startRun({ mode: "daily", dailyDate: "2026-10-03", runSeed: 1, tier: "normal", level: 1 });
    useGameStore.setState({ score: 42, gameState: GameStateEnum.FINISH });
    useGameStore.getState().submitGameResult();
    expect(recordGame).not.toHaveBeenCalled();
    const after = useSaveStore.getState().save;
    expect(after.progress.bestScore).toBe(0);
    expect(after.daily).toMatchObject({ date: "2026-10-03", best: 42 });
    expect(useGameStore.getState().gameRecord).toMatchObject({ mode: "daily", dailyBest: 42 });
    recordGame.mockRestore();
  });

  it("Infini : record enregistré, sauf en mode calme", () => {
    useGameStore.getState().startRun({ mode: "endless", runSeed: 1, tier: "normal", level: 1 });
    useGameStore.setState({ score: 9 });
    useGameStore.getState().submitGameResult();
    expect(useSaveStore.getState().save.progress.bestScore).toBe(9);
    expect(useGameStore.getState().gameRecord?.isNewRecord).toBe(true);

    useGameStore.getState().setClearGameStore();
    useGameStore.getState().startRun({ mode: "endless", calm: true, runSeed: 1, tier: "normal", level: 1 });
    useGameStore.setState({ score: 50 });
    useGameStore.getState().submitGameResult();
    expect(useSaveStore.getState().save.progress.bestScore).toBe(9);
  });
});

describe("découverte", () => {
  it("rien n'est marqué vu à la génération ; markDiscoverySeen le fait", () => {
    useGameStore.getState().setCurrentSpec(spec);
    const { isDiscovery, freshMechanics } = useGameStore.getState();
    expect(isDiscovery).toBe(true);
    expect(freshMechanics).toEqual(mechanicsOf(spec));
    expect(useSaveStore.getState().save.seenMechanics).toEqual([]);

    useGameStore.getState().markDiscoverySeen();
    expect(useSaveStore.getState().save.seenMechanics).toEqual(freshMechanics);
  });

  it("repli : marqué si le niveau est réussi sans fermer la carte", () => {
    useGameStore.setState({ gameState: GameStateEnum.PLAYING });
    useGameStore.getState().setCurrentSpec(spec);
    useGameStore.getState().recordTargetFound(1, true);
    expect(useSaveStore.getState().save.seenMechanics).toEqual(mechanicsOf(spec));
  });

  it("repli : marqué à la fin de la partie", () => {
    useGameStore.getState().setCurrentSpec(spec);
    useGameStore.getState().submitGameResult();
    expect(useSaveStore.getState().save.seenMechanics).toEqual(mechanicsOf(spec));
  });

  it("setClearGameStore vide le cache : même niveau rejoué → découverte recalculée", () => {
    useGameStore.getState().setCurrentSpec(spec);
    useGameStore.getState().markDiscoverySeen();
    // sans remise à zéro du cache, le niveau resterait « découverte »
    useGameStore.getState().setClearGameStore();
    useGameStore.getState().setCurrentSpec(spec);
    expect(useGameStore.getState().isDiscovery).toBe(false);
    expect(useGameStore.getState().freshMechanics).toEqual([]);
  });

  it("le même niveau généré deux fois (StrictMode) garde sa découverte", () => {
    useGameStore.getState().setCurrentSpec(spec);
    useGameStore.getState().setCurrentSpec(spec);
    expect(useGameStore.getState().isDiscovery).toBe(true);
  });
});

describe("goldRush en pause", () => {
  it("garde le temps restant et recale l'échéance à la reprise", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    useGameStore.setState({ currentSpec: { ...spec, rule: "goldRush" }, bonusDone: false, bonusEndsAt: null });
    useGameStore.getState().startBonus(8);
    vi.setSystemTime(1_003_000);
    useGameStore.getState().pauseBonus();
    expect(useGameStore.getState().bonusPausedMs).toBe(5_000);
    vi.setSystemTime(1_063_000); // 1 min en arrière-plan
    useGameStore.getState().resumeBonus();
    expect(useGameStore.getState().bonusEndsAt).toBe(1_068_000);
    expect(useGameStore.getState().bonusPausedMs).toBeNull();
    vi.useRealTimers();
  });
});
