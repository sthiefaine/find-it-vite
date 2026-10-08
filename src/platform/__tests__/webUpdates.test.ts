import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const save = vi.hoisted(() => ({ loaded: true, flush: vi.fn<() => Promise<void>>(async () => undefined) }));
vi.mock("../../save/saveStore", () => ({ useSaveStore: { getState: () => save } }));

let page: EventTarget & { visibilityState: string };
let browser: EventTarget & { location: { pathname: string; reload: ReturnType<typeof vi.fn> } };
let network: { onLine: boolean; serviceWorker: { register: ReturnType<typeof vi.fn> } };
let worker: EventTarget & { scope: string; active: object; installing: null; update: ReturnType<typeof vi.fn>; unregister: ReturnType<typeof vi.fn> };
let stop: (() => void) | undefined;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DEV", false);
  page = Object.assign(new EventTarget(), { visibilityState: "visible" });
  browser = Object.assign(new EventTarget(), { location: { pathname: "/options", reload: vi.fn() } });
  worker = Object.assign(new EventTarget(), {
    scope: "https://findit.example/", active: {}, installing: null, update: vi.fn(async () => worker), unregister: vi.fn(async () => true),
  });
  network = { onLine: true, serviceWorker: { register: vi.fn(async () => worker) } };
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", browser);
  vi.stubGlobal("navigator", network);
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => __APP_BUILD__ })));
  save.loaded = true;
  save.flush.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  stop?.();
  stop = undefined;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function start() {
  const updates = await import("../webUpdates");
  let callbacks: Parameters<typeof import("virtual:pwa-register").registerSW>[0];
  stop = updates.startWebUpdates((options) => {
    callbacks = options;
    options?.onRegisteredSW?.("/sw.js", worker as unknown as ServiceWorkerRegistration);
    return async () => undefined;
  });
  // L'enregistrement natif qui désactive le cache précède la première vérification.
  await Promise.resolve();
  await Promise.resolve();
  await updates.checkWebUpdates();
  return { ...updates, callbacks: callbacks! };
}

describe("mises à jour web et PWA", () => {
  it("lit la version sans cache et force la vérification du service worker", async () => {
    const updates = await start();
    expect(network.serviceWorker.register).toHaveBeenCalledWith("/sw.js", { scope: worker.scope, updateViaCache: "none" });
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/version.json\?check=\d+$/), expect.objectContaining({ cache: "no-store" }));
    expect(worker.update).toHaveBeenCalled();
    expect(updates.useWebUpdateStore.getState().status).toBe("current");
  });

  it("attend l'activation du nouveau worker avant de proposer le rechargement", async () => {
    const updates = await start();
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ buildId: "nouvelle-version" }) } as Response);
    await updates.checkWebUpdates();
    expect(updates.useWebUpdateStore.getState().status).toBe("downloading");
    updates.callbacks.onNeedReload?.();
    expect(updates.useWebUpdateStore.getState().status).toBe("ready");
  });

  it("ne recharge jamais une partie, un duel ou un salon, même en pause", async () => {
    const updates = await start();
    updates.callbacks.onNeedReload?.();
    for (const pathname of ["/game", "/duel", "/multiplayer"]) {
      browser.location.pathname = pathname;
      await updates.applyWebUpdate();
    }
    expect(save.flush).not.toHaveBeenCalled();
    expect(browser.location.reload).not.toHaveBeenCalled();
    expect(updates.useWebUpdateStore.getState().status).toBe("ready");
  });

  it("termine la sauvegarde avant de recharger un menu", async () => {
    const updates = await start();
    updates.callbacks.onNeedReload?.();
    let finish!: () => void;
    save.flush.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
    const applied = updates.applyWebUpdate();
    expect(browser.location.reload).not.toHaveBeenCalled();
    finish();
    await applied;
    expect(browser.location.reload).toHaveBeenCalledOnce();
  });

  it("annule le rechargement si une partie commence pendant la sauvegarde", async () => {
    const updates = await start();
    updates.callbacks.onNeedReload?.();
    save.flush.mockImplementationOnce(async () => { browser.location.pathname = "/game"; });
    await updates.applyWebUpdate();
    expect(browser.location.reload).not.toHaveBeenCalled();
  });

  it("ignore les événements rapprochés et les onglets masqués, puis revérifie au retour du réseau", async () => {
    const updates = await start();
    vi.mocked(fetch).mockClear();
    browser.dispatchEvent(new Event("focus"));
    page.dispatchEvent(new Event("visibilitychange"));
    await updates.checkWebUpdates(false);
    expect(fetch).not.toHaveBeenCalled();
    page.visibilityState = "hidden";
    await updates.checkWebUpdates(false);
    expect(fetch).not.toHaveBeenCalled();
    page.visibilityState = "visible";
    browser.dispatchEvent(new Event("online"));
    await updates.checkWebUpdates();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("conserve la version installée hors ligne et permet une nouvelle tentative après une erreur", async () => {
    const updates = await start();
    network.onLine = false;
    vi.mocked(fetch).mockClear();
    await updates.checkWebUpdates();
    expect(updates.useWebUpdateStore.getState().status).toBe("offline");
    expect(fetch).not.toHaveBeenCalled();
    network.onLine = true;
    vi.mocked(fetch).mockRejectedValueOnce(new Error("réseau"));
    await updates.checkWebUpdates();
    expect(updates.useWebUpdateStore.getState().status).toBe("error");
    await updates.checkWebUpdates();
    expect(updates.useWebUpdateStore.getState().status).toBe("current");
  });

  it("garde une mise à jour prête si le téléphone perd ensuite le réseau", async () => {
    const updates = await start();
    updates.callbacks.onNeedReload?.();
    network.onLine = false;
    await updates.checkWebUpdates();
    expect(updates.useWebUpdateStore.getState().status).toBe("ready");
  });

  it("attend la fin du chargement de la sauvegarde et le retour au premier plan", async () => {
    const updates = await start();
    updates.callbacks.onNeedReload?.();
    save.loaded = false;
    await updates.applyWebUpdate();
    save.loaded = true;
    page.visibilityState = "hidden";
    await updates.applyWebUpdate();
    expect(browser.location.reload).not.toHaveBeenCalled();
    page.visibilityState = "visible";
    await updates.applyWebUpdate();
    expect(browser.location.reload).toHaveBeenCalledOnce();
  });

  it("répare une PWA bloquée après une vérification réseau, sans toucher à la progression", async () => {
    const updates = await start();
    await updates.applyWebUpdate(true);
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/index.html\?update=/), expect.objectContaining({ cache: "no-store" }));
    expect(save.flush).toHaveBeenCalledOnce();
    expect(worker.unregister).toHaveBeenCalledOnce();
    expect(browser.location.reload).toHaveBeenCalledOnce();
  });

  it("ne désenregistre pas la PWA si le réseau est indisponible ou si une partie est ouverte", async () => {
    const updates = await start();
    network.onLine = false;
    await updates.applyWebUpdate(true);
    network.onLine = true;
    vi.mocked(fetch).mockRejectedValueOnce(new Error("réseau"));
    await updates.applyWebUpdate(true);
    browser.location.pathname = "/game";
    await updates.applyWebUpdate(true);
    expect(worker.unregister).not.toHaveBeenCalled();
    expect(browser.location.reload).not.toHaveBeenCalled();
  });
});
