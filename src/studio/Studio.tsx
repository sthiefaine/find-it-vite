import { useEffect, useState } from "react";
import { ArrowUpRight, Check, CheckCircle2, Copy, ImagePlus, Layers3, Plus, Search, Sparkles, X } from "lucide-react";
import { CATEGORIES, COLORS, gameSprites, imageUrl, slugify, spritePrompt } from "./model";
import type { AssetInfo, Catalog, Category, PublishedAnimal, Sprite, Theme } from "./model";

type StudioState = { catalog: Catalog; assets: AssetInfo[]; published: PublishedAnimal[] };
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(`/__studio/${url}`, body === undefined ? undefined : {
    method: "POST", headers: { "Content-Type": "application/json", "X-Find-It-Studio": "1" }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "L’atelier ne répond pas.");
  return data;
}
const themeIcons: Record<Category, string> = { animals: "🐾", people: "🙂", history: "🏛️", politics: "🎙️", flags: "🏳️", fantasy: "✨" };
const colorLabels = ["Brun", "Gris", "Jaune", "Blanc", "Vert", "Bleu", "Rouge", "Orange", "Rose", "Violet", "Noir"];

export default function Studio() {
  const [state, setState] = useState<StudioState | null>(null);
  const [themeId, setThemeId] = useState("animaux");
  const [selected, setSelected] = useState<Sprite | null>(null);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creatingTheme, setCreatingTheme] = useState(false);
  const [themeName, setThemeName] = useState("");
  const [category, setCategory] = useState<Category>("animals");
  const [background, setBackground] = useState("checker");
  const [transparentPrompt, setTransparentPrompt] = useState(true);
  const catalog = state?.catalog;
  const theme = catalog?.themes.find((t) => t.id === themeId);
  const savedSprite = catalog?.sprites.find((s) => s.id === selected?.id);
  const dirty = selected !== null && JSON.stringify(selected) !== JSON.stringify(savedSprite);
  const asset = state?.assets.find((a) => a.source === selected?.source);
  const candidates = catalog ? gameSprites(catalog) : [];
  const prompt = spritePrompt(theme?.category ?? "animals", selected?.subject ?? "", transparentPrompt);

  useEffect(() => {
    let active = true;
    request<StudioState>("catalog").then((data) => {
      if (!active) return;
      setState(data);
      setThemeId(data.catalog.themes[0]?.id ?? "");
      setSelected(data.catalog.sprites[0] ?? null);
    }).catch((e: Error) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);

  const canLeave = () => !dirty || window.confirm("Les modifications de ce sprite ne sont pas enregistrées. Les abandonner ?");
  const edit = (update: Partial<Sprite>) => setSelected((s) => s ? { ...s, ...update } : s);
  async function perform(action: () => Promise<void>) {
    setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Opération impossible."); }
    finally { setBusy(false); }
  }
  function chooseTheme(t: Theme) {
    if (!canLeave()) return;
    setThemeId(t.id); setSelected(catalog?.sprites.find((s) => s.themeId === t.id) ?? null); setSearch(""); setNotice("");
  }
  function newSprite() {
    if (!theme || !canLeave()) return;
    setSelected({ id: `sprite-${crypto.randomUUID().slice(0, 8)}`, themeId, label: "", subject: "", color: "brown", family: "", status: "draft", source: null, notes: "" });
  }
  async function saveSprite() {
    if (!catalog || !selected) return;
    await perform(async () => {
      const sprite = savedSprite ? selected : { ...selected, id: slugify(`${themeId}-${selected.label}`) };
      if (!savedSprite && catalog.sprites.some((s) => s.id === sprite.id)) throw new Error("Ce nom existe déjà dans ce thème.");
      const next = await request<Catalog>("catalog", { ...catalog, sprites: savedSprite ? catalog.sprites.map((s) => s.id === sprite.id ? sprite : s) : [...catalog.sprites, sprite] });
      setState((s) => s ? { ...s, catalog: next } : s);
      setSelected(sprite); setNotice("Sprite enregistré dans le catalogue.");
    });
  }
  async function createTheme() {
    if (!catalog) return;
    await perform(async () => {
      const item: Theme = { id: slugify(themeName), name: themeName.trim(), category, destination: category === "animals" ? "game" : "fun" };
      const next = await request<Catalog>("catalog", { ...catalog, themes: [...catalog.themes, item] });
      setState((s) => s ? { ...s, catalog: next } : s); setThemeId(item.id); setSelected(null);
      setCreatingTheme(false); setThemeName(""); setSearch(""); setNotice("Le thème est prêt. Ajoute ton premier sprite.");
    });
  }
  async function upload(file: File) {
    await perform(async () => {
      if (file.size > 8 * 1024 * 1024) throw new Error("L’image dépasse 8 Mo.");
      const response = await fetch("/__studio/upload", { method: "POST", headers: { "X-Find-It-Studio": "1" }, body: file });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Import impossible.");
      const uploaded = data as AssetInfo;
      setState((s) => s ? { ...s, assets: [...s.assets.filter((a) => a.source !== uploaded.source), uploaded] } : s);
      edit({ source: uploaded.source, status: "draft" });
      setNotice("Image importée. Enregistre le sprite pour conserver cette association.");
    });
  }

  if (!state) return <main className="studio-loading"><Sparkles /><h1>Find It · Atelier</h1><p>{error || "Ouverture du catalogue…"}</p>{error && <button onClick={() => location.reload()}>Réessayer</button>}</main>;
  const visible = state.catalog.sprites.filter((s) => s.themeId === themeId && `${s.label} ${s.subject}`.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")));
  const themeSprites = state.catalog.sprites.filter((s) => s.themeId === themeId);
  const thumbnail = imageUrl(selected?.source ?? null);

  return <div className="studio-shell">
    <aside className="studio-sidebar">
      <a className="studio-brand" href="/studio.html"><span className="brand-mark">f<span>i</span></span><span>find it<span className="brand-caption">L’atelier des sprites</span></span></a>
      <div className="sidebar-section-label">TA BIBLIOTHÈQUE <Layers3 size={15} /></div>
      <nav aria-label="Thèmes du catalogue">
        {(["game", "fun"] as const).map((destination) => <div key={destination} className="theme-group">
          <p>{destination === "game" ? "DANS LE JEU" : "POUR LE FUN"}</p>
          {state.catalog.themes.filter((t) => t.destination === destination).map((t) => <button key={t.id} className={`theme-button ${themeId === t.id ? "is-active" : ""}`} aria-pressed={themeId === t.id} disabled={busy} onClick={() => chooseTheme(t)}>
            <span className="theme-emoji">{themeIcons[t.category]}</span><span>{t.name}</span><span className="theme-count">{state.catalog.sprites.filter((s) => s.themeId === t.id).length}</span>
          </button>)}
        </div>)}
      </nav>
      <button className="new-theme-button" disabled={busy} onClick={() => { if (canLeave()) setCreatingTheme(true); }}><Plus size={16} /> Créer un thème</button>
      <div className="sidebar-note"><span className="local-dot" /> Atelier local<p>Tes images et ton catalogue restent dans ce projet.</p></div>
    </aside>

    <main className="studio-main">
      <header className="studio-topbar"><span>Bibliothèque <span className="breadcrumb-slash">/</span> {theme?.name}</span><a href="/" target="_blank" rel="noreferrer">Ouvrir le jeu <ArrowUpRight size={15} /></a></header>
      <div className="studio-content">
        <section className="studio-heading"><div><span className="eyebrow">UNE TÊTE. MILLE POSSIBILITÉS.</span><h1>{theme?.name}</h1><p>{theme?.destination === "game" ? "Les petites têtes qui donnent vie à Find It." : "Un terrain de jeu créatif, à part du jeu principal."}</p></div><button className="primary-button" disabled={busy} onClick={newSprite}><Plus size={17} /> Nouveau sprite</button></section>
        <section className="publish-strip"><span className="publish-icon"><CheckCircle2 size={20} /></span><div><strong>{state.published.length} animaux intégrés au jeu</strong><p>{candidates.length} prêts dans le catalogue · les brouillons et les thèmes fun restent dans l’atelier.</p></div><button className="secondary-button" disabled={busy || dirty} title={dirty ? "Enregistre le sprite avant de mettre à jour le jeu" : undefined} onClick={() => void perform(async () => {
          const published = await request<PublishedAnimal[]>("publish", { revision: state.catalog.revision });
          setState((s) => s ? { ...s, published } : s); setNotice("Le catalogue du jeu est à jour. Ouvre le jeu pour tester tes animaux.");
        })}>Mettre à jour le jeu <ArrowUpRight size={15} /></button></section>
        {error && <div className="studio-message error" role="alert">{error}<button aria-label="Fermer l’erreur" onClick={() => setError("")}><X size={16} /></button></div>}
        {notice && <div className="studio-message success" role="status">{notice}<button aria-label="Fermer le message" onClick={() => setNotice("")}><X size={16} /></button></div>}
        <div className="workspace-grid">
          <section className="library-panel" aria-label="Sprites du thème">
            <div className="library-toolbar"><span>{themeSprites.length} sprite{themeSprites.length > 1 ? "s" : ""}</span><label className="search-field"><Search size={16} /><input aria-label="Rechercher un sprite" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" /></label></div>
            <div className="sprite-grid">{visible.map((sprite) => <button className={`sprite-card ${selected?.id === sprite.id ? "is-selected" : ""}`} key={sprite.id} disabled={busy} aria-pressed={selected?.id === sprite.id} onClick={() => { if (canLeave()) setSelected(sprite); }}>
              <span className="sprite-card-art">{sprite.source ? <img src={imageUrl(sprite.source)} alt="" loading="lazy" /> : <ImagePlus size={30} />}{selected?.id === sprite.id && <span className="selection-check"><Check size={12} /></span>}</span>
              <strong>{sprite.label}</strong><span className={`sprite-status ${sprite.status}`}>{sprite.status === "ready" ? "Validé" : "Brouillon"}</span>
            </button>)}
            {themeSprites.length > 0 && <button className="sprite-add-card" disabled={busy} onClick={newSprite}><Plus size={25} /><span>Ajouter un sprite</span></button>}</div>
            {themeSprites.length === 0 && <div className="library-empty"><span>{themeIcons[theme?.category ?? "animals"]}</span><h2>Une collection à imaginer</h2><p>Ajoute un sujet, prépare son prompt puis importe ton image.</p><button className="secondary-button" disabled={busy} onClick={newSprite}><Plus size={16} /> Créer le premier sprite</button></div>}
            {themeSprites.length > 0 && !visible.length && <p className="no-results">Aucun sprite ne correspond à ta recherche.</p>}
            <div className="library-footnote"><Sparkles size={15} /><p>Un style cohérent, même en tout petit.<br /><span>Vue de face · tête seule · fond transparent</span></p></div>
          </section>

          <aside className="editor-panel" aria-label="Éditeur de sprite">
            {selected ? <>
              <div className="editor-title"><span>LE SPRITE</span><span>{dirty ? "• Non enregistré" : "Enregistré"}</span></div>
              <div className={`sprite-preview preview-${background}`}>{thumbnail ? <img src={thumbnail} alt={`Aperçu de ${selected.label || "ton sprite"}`} /> : <div className="preview-placeholder"><ImagePlus size={36} /><p>Ton prochain personnage</p></div>}</div>
              <div className="preview-toolbar"><span>{asset ? `${asset.width} × ${asset.height} · ${asset.transparent ? "Transparent" : "Fond opaque"}` : "PNG ou WebP"}</span><div aria-label="Fond de l’aperçu">{["checker", "cream", "night"].map((bg) => <button key={bg} aria-label={`Fond ${bg === "checker" ? "damier" : bg === "cream" ? "clair" : "sombre"}`} aria-pressed={background === bg} className={`preview-swatch preview-${bg}`} onClick={() => setBackground(bg)} />)}</div></div>
              <label className={`upload-button ${busy ? "disabled" : ""}`}><ImagePlus size={16} /> {selected.source ? "Importer une autre image" : "Importer une image"}<input type="file" accept="image/png,image/webp" disabled={busy} aria-label="Importer une image PNG ou WebP" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} /></label>
              {asset && (!asset.transparent || asset.width !== asset.height || asset.width < 128) && theme?.destination === "game" && <p className="image-advice">Pour le jeu : image carrée, transparente, de 128 px minimum. Le fond blanc reste utile comme référence.</p>}
              <form className="sprite-form" onSubmit={(e) => { e.preventDefault(); void saveSprite(); }}>
                <label>Nom affiché<input required maxLength={80} value={selected.label} disabled={busy} placeholder="Hippopotame" onChange={(e) => edit({ label: e.target.value })} /></label>
                <label>Sujet du prompt<input required maxLength={240} value={selected.subject} disabled={busy} placeholder="un hippopotame" onChange={(e) => edit({ subject: e.target.value })} /></label>
                <div className="form-row"><label>Couleur dominante<select value={selected.color} disabled={busy} onChange={(e) => edit({ color: e.target.value as Sprite["color"] })}>{COLORS.map((color, i) => <option key={color} value={color}>{colorLabels[i]}</option>)}</select></label><label>Famille visuelle<input required maxLength={64} value={selected.family} disabled={busy} placeholder="gris" onChange={(e) => edit({ family: e.target.value })} /></label></div>
                <label>État<select value={selected.status} disabled={busy} onChange={(e) => edit({ status: e.target.value as Sprite["status"] })}><option value="draft">Brouillon</option><option value="ready" disabled={!selected.source}>Validé</option></select></label>
                <label>Notes<textarea rows={2} maxLength={2000} value={selected.notes} disabled={busy} placeholder="Idées, variantes, détails à retoucher…" onChange={(e) => edit({ notes: e.target.value })} /></label>
                <button className="primary-button save-button" disabled={busy || !dirty} type="submit">{busy ? "En cours…" : "Enregistrer le sprite"}</button>
              </form>
              <details className="prompt-panel" open><summary><Sparkles size={15} /> Le prompt de création</summary><div className="prompt-options"><label><input type="checkbox" checked={transparentPrompt} onChange={(e) => setTransparentPrompt(e.target.checked)} /> Fond transparent</label><button onClick={() => void perform(async () => { await navigator.clipboard.writeText(prompt); setNotice("Prompt copié. Génère l’image dans ton outil habituel, puis importe-la ici."); })} disabled={busy}><Copy size={14} /> Copier</button></div><textarea aria-label="Prompt de création" readOnly value={prompt} rows={5} /><p>Copie le prompt dans ton outil de génération, puis importe le résultat.</p></details>
              <div className="in-game-preview"><span>À LA TAILLE DU JEU · 45 PX</span><div>{thumbnail ? Array.from({ length: 12 }, (_, index) => <img key={index} src={index === 4 ? thumbnail : imageUrl(candidates[index % Math.max(1, candidates.length)]?.source ?? selected.source)} alt={index === 4 ? selected.label : ""} />) : <p>Importe une image pour l’essayer dans la foule.</p>}</div></div>
            </> : <div className="editor-empty"><ImagePlus size={36} /><p>Sélectionne un sprite<br />ou imagine le prochain.</p></div>}
          </aside>
        </div>
      </div>
    </main>
    {creatingTheme && <div className="studio-modal-backdrop"><section className="studio-modal" role="dialog" aria-modal="true" aria-labelledby="theme-title"><button className="modal-close" disabled={busy} onClick={() => setCreatingTheme(false)} aria-label="Fermer"><X size={20} /></button><span className="eyebrow">UNE NOUVELLE COLLECTION</span><h2 id="theme-title">Créer un thème</h2><form onSubmit={(e) => { e.preventDefault(); void createTheme(); }}><label>Nom du thème<input required maxLength={80} autoFocus value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder="Les animaux de la forêt" /></label><label>Catégorie<select value={category} onChange={(e) => setCategory(e.target.value as Category)}>{Object.entries(CATEGORIES).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><p>{category === "animals" ? "Les sprites validés pourront être intégrés au jeu." : "Ce thème restera dans l’atelier, pour le fun."}</p>{error && <p role="alert" className="image-advice">{error}</p>}<button className="primary-button" disabled={busy}>Créer le thème</button></form></section></div>}
  </div>;
}
