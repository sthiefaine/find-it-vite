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

describe("masque de premier plan", () => {
  it("ne modifie pas la pause du joueur et se réinitialise entre les parties", () => {
    const store = useGameStore.getState();
    store.setPauseTimer(true);
    store.setObstacleBlocking(true);
    store.setObstacleBlocking(false);
    expect(useGameStore.getState().pauseTimer).toBe(true);
    store.setObstacleBlocking(true);
    store.setClearGameStore();
    expect(useGameStore.getState().obstacleBlocking).toBe(false);
  });
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

describe("Aventure continue", () => {
  const startAdventure = (worldId: "animaux" | "ocean", level: number) => {
    useGameStore.getState().startRun({ mode: "adventure", worldId, adventureLevel: level, runSeed: 1, tier: "normal", level: 1 });
    useGameStore.setState({ gameState: GameStateEnum.PLAYING });
  };
  // Un avis trouvé (niveau fini) puis, après l'animation, le niveau suivant
  const findAvis = (playMs = 1000) => {
    const s = useGameStore.getState();
    s.addPlayTime(playMs);
    s.setCurrentSpec({ ...spec, seed: s.level * 1000 + s.adventureStep });
    s.recordTargetFound(1, true);
    if (useGameStore.getState().unlockQueue.length) s.dismissUnlock();
    else s.advanceLevel();
  };

  it("5 avis = 1 étape : étoiles enregistrées tout de suite, bandeau, sans fin de partie", () => {
    startAdventure("animaux", 1);
    for (let i = 0; i < 4; i++) findAvis(2000);
    expect(useGameStore.getState().missionFound).toBe(4);
    expect(useGameStore.getState().stepToast).toBeNull();
    const s = useGameStore.getState();
    s.addPlayTime(2000);
    s.setCurrentSpec({ ...spec, seed: 99 });
    s.recordTargetFound(1, true);
    expect(useSaveStore.getState().save.adventure.stars["animaux:1"]).toBe(3); // 10 s
    expect(useGameStore.getState().stepToast).toMatchObject({ level: 1, stars: 3 });
    useGameStore.getState().advanceLevel();
    const after = useGameStore.getState();
    expect(after.gameState).toBe(GameStateEnum.PLAYING);
    expect(after).toMatchObject({ adventureStep: 2, adventureLevel: 2, missionFound: 0, stepPlayMs: 0 });
  });

  it("étoiles selon le temps, et on garde le meilleur résultat", () => {
    useSaveStore.getState().recordStars("animaux", 1, 3);
    startAdventure("animaux", 1);
    for (let i = 0; i < 5; i++) findAvis(10_000); // 50 s
    expect(useGameStore.getState().runSteps).toEqual([{ step: 1, worldId: "animaux", level: 1, stars: 1 }]);
    expect(useSaveStore.getState().save.adventure.stars["animaux:1"]).toBe(3);
  });

  it("après l'étape 20, passe au monde suivant avec un bandeau, et l'océan est ouvert", () => {
    startAdventure("animaux", 20);
    for (let i = 0; i < 5; i++) findAvis(5000); // 25 s
    const s = useGameStore.getState();
    expect(s).toMatchObject({ adventureStep: 21, worldId: "ocean", adventureLevel: 1 });
    expect(s.worldBanner).toMatchObject({ phase: "ocean" });
    expect(s.runPhases).toEqual(["animaux", "ocean"]);
    expect(useSaveStore.getState().save.adventure.stars["animaux:20"]).toBe(3);
    s.hideWorldBanner();
    expect(useGameStore.getState().worldBanner).toBeNull();

    useGameStore.setState({ gameState: GameStateEnum.FINISH });
    useGameStore.getState().submitGameResult();
    expect(useGameStore.getState().gameRecord?.adventure).toMatchObject({
      startStep: 20,
      endStep: 21,
      stepsCleared: 1,
      starsEarned: 3,
      discoveredWorlds: ["ocean"],
    });
  });

  it("mode calme : appliqué à l'Aventure, pas au Défi", () => {
    useGameStore.getState().startRun({ mode: "adventure", worldId: "animaux", adventureLevel: 1, calm: true, runSeed: 1, tier: "normal", level: 1 });
    expect(useGameStore.getState().calm).toBe(true);
    useGameStore.getState().startRun({ mode: "daily", calm: true, runSeed: 1, tier: "normal", level: 1 });
    expect(useGameStore.getState().calm).toBe(false);
  });

  it("chrono plafonné à 60 s en Aventure", () => {
    startAdventure("ocean", 1);
    useGameStore.setState({ timeLeft: 58 });
    useGameStore.getState().setTimeLeft(5);
    expect(useGameStore.getState().timeLeft).toBe(60);
  });
});
