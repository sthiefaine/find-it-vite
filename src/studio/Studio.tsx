import { useEffect, useState } from "react";
import { ArrowUpRight, Check, CheckCircle2, Copy, ImagePlus, Layers3, Plus, Search, Sparkles, X } from "lucide-react";
import { CATEGORIES, COLORS, gameSprites, imageUrl, slugify, spritePrompt } from "./model";
import type { AssetInfo, Catalog, Category, PublishedAnimal, Sprite, Theme } from "./model";
import { ANIMAL_CATEGORIES, ANIMAL_COLORS, ANIMAL_SPECIES, BREED_SUGGESTIONS, animalCategoryLabel, animalSpeciesLabel, matchesAnimalSearch, normalizedAnimalMetadata } from "../content/animalTaxonomy";
import { ACCESSORIES, type AccessoryId } from "../content/accessories";
import { AnimalPortrait } from "../components/AnimalPortrait/AnimalPortrait";

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
const ALL_ANIMALS = "__animals";

export default function Studio() {
  const [state, setState] = useState<StudioState | null>(null);
  const [themeId, setThemeId] = useState("animaux");
  const [selected, setSelected] = useState<Sprite | null>(null);
  const [search, setSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [colorFilter, setColorFilter] = useState("");
  const [newTag, setNewTag] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [creatingTheme, setCreatingTheme] = useState(false);
  const [themeName, setThemeName] = useState("");
  const [category, setCategory] = useState<Category>("animals");
  const [background, setBackground] = useState("checker");
  const [transparentPrompt, setTransparentPrompt] = useState(true);
  const [previewAccessory, setPreviewAccessory] = useState<AccessoryId | null>(null);
  const catalog = state?.catalog;
  const theme = catalog?.themes.find((t) => t.id === themeId);
  const selectedTheme = catalog?.themes.find((t) => t.id === selected?.themeId);
  const allAnimals = themeId === ALL_ANIMALS;
  const animalView = allAnimals || theme?.category === "animals";
  const savedSprite = catalog?.sprites.find((s) => s.id === selected?.id);
  const dirty = selected !== null && JSON.stringify(selected) !== JSON.stringify(savedSprite);
  const asset = state?.assets.find((a) => a.source === selected?.source);
  const candidates = catalog ? gameSprites(catalog) : [];
  const prompt = spritePrompt(selectedTheme?.category ?? "animals", selected?.subject ?? "", transparentPrompt, selected ?? undefined);

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
  function chooseTheme(t: Theme | null) {
    if (!canLeave()) return;
    setThemeId(t?.id ?? ALL_ANIMALS);
    setSelected(catalog?.sprites.find((s) => t ? s.themeId === t.id : catalog.themes.some((candidate) => candidate.id === s.themeId && candidate.category === "animals")) ?? null);
    setSearch(""); setSpeciesFilter(""); setTagFilter(""); setColorFilter(""); setNewTag(""); setNotice("");
  }
  function newSprite() {
    const destination = theme ?? catalog?.themes.find((t) => t.category === "animals");
    if (!destination || !canLeave()) return;
    setNewTag("");
    setSelected({ id: `sprite-${crypto.randomUUID().slice(0, 8)}`, themeId: destination.id, label: "", subject: "", color: "brown", family: "", species: "", breed: "", dominantColors: ["brown"], tags: destination.id === "ferme" ? ["ferme"] : [], status: "draft", source: null, notes: "" });
  }
  async function saveSprite() {
    if (!catalog || !selected) return;
    await perform(async () => {
      const sprite = savedSprite ? selected : { ...selected, id: slugify(`${selected.themeId}-${selected.label}`) };
      if (!savedSprite && catalog.sprites.some((s) => s.id === sprite.id)) throw new Error("Ce nom existe déjà dans ce thème.");
      const next = await request<Catalog>("catalog", { ...catalog, sprites: savedSprite ? catalog.sprites.map((s) => s.id === sprite.id ? sprite : s) : [...catalog.sprites, sprite] });
      setState((s) => s ? { ...s, catalog: next } : s);
      setSelected(next.sprites.find((s) => s.id === sprite.id) ?? sprite); setNotice("Sprite enregistré dans le catalogue.");
    });
  }
  async function createTheme() {
    if (!catalog) return;
    await perform(async () => {
      const item: Theme = { id: slugify(themeName), name: themeName.trim(), category, destination: category === "animals" ? "game" : "fun" };
      const next = await request<Catalog>("catalog", { ...catalog, themes: [...catalog.themes, item] });
      setState((s) => s ? { ...s, catalog: next } : s); setThemeId(item.id); setSelected(null);
      setCreatingTheme(false); setThemeName(""); setSearch(""); setSpeciesFilter(""); setTagFilter(""); setColorFilter(""); setNotice("Le thème est prêt. Ajoute ton premier sprite.");
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
  const animalThemeIds = new Set(state.catalog.themes.filter((t) => t.category === "animals").map((t) => t.id));
  const themeSprites = state.catalog.sprites.filter((s) => allAnimals ? animalThemeIds.has(s.themeId) : s.themeId === themeId);
  const visible = themeSprites.filter((s) => matchesAnimalSearch(s, search) && (!speciesFilter || s.species === speciesFilter) && (!tagFilter || s.tags?.includes(tagFilter)) && (!colorFilter || normalizedAnimalMetadata(s).dominantColors.includes(colorFilter as Sprite["color"])));
  const availableSpecies = [...new Set(themeSprites.flatMap((s) => s.species ? [s.species] : []))].sort((a, b) => animalSpeciesLabel(a).localeCompare(animalSpeciesLabel(b), "fr"));
  const availableTags = [...new Set(themeSprites.flatMap((s) => s.tags ?? []))].sort((a, b) => animalCategoryLabel(a).localeCompare(animalCategoryLabel(b), "fr"));
  const thumbnail = imageUrl(selected?.source ?? null);
  const metadata = selected ? normalizedAnimalMetadata(selected) : null;
  const title = allAnimals ? "Tous les animaux" : theme?.name;

  return <div className="studio-shell">
    <aside className="studio-sidebar">
      <a className="studio-brand" href="/studio.html"><span className="brand-mark">f<span>i</span></span><span>find it<span className="brand-caption">L’atelier des sprites</span></span></a>
      <div className="sidebar-section-label">TA BIBLIOTHÈQUE <Layers3 size={15} /></div>
      <nav aria-label="Thèmes du catalogue">
        <button className={`theme-button all-animals-button ${allAnimals ? "is-active" : ""}`} aria-pressed={allAnimals} disabled={busy} onClick={() => chooseTheme(null)}><span className="theme-emoji">🐾</span><span>Tous les animaux</span><span className="theme-count">{state.catalog.sprites.filter((s) => animalThemeIds.has(s.themeId)).length}</span></button>
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
      <header className="studio-topbar"><span>Bibliothèque <span className="breadcrumb-slash">/</span> {title}</span><a href="/" target="_blank" rel="noreferrer">Ouvrir le jeu <ArrowUpRight size={15} /></a></header>
      <div className="studio-content">
        <section className="studio-heading"><div><span className="eyebrow">UNE TÊTE. MILLE POSSIBILITÉS.</span><h1>{title}</h1><p>{animalView ? "Des espèces, des races et des couleurs pour enrichir les recherches." : "Un terrain de jeu créatif, à part du jeu principal."}</p></div><button className="primary-button" disabled={busy} onClick={newSprite}><Plus size={17} /> Nouveau sprite</button></section>
        <section className="publish-strip"><span className="publish-icon"><CheckCircle2 size={20} /></span><div><strong>{state.published.length} animaux intégrés au jeu</strong><p>{candidates.length} prêts dans le catalogue · les brouillons et les thèmes fun restent dans l’atelier.</p></div><button className="secondary-button" disabled={busy || dirty} title={dirty ? "Enregistre le sprite avant de mettre à jour le jeu" : undefined} onClick={() => void perform(async () => {
          const published = await request<PublishedAnimal[]>("publish", { revision: state.catalog.revision });
          setState((s) => s ? { ...s, published } : s); setNotice("Le catalogue du jeu est à jour. Ouvre le jeu pour tester tes animaux.");
        })}>Mettre à jour le jeu <ArrowUpRight size={15} /></button></section>
        {error && <div className="studio-message error" role="alert">{error}<button aria-label="Fermer l’erreur" onClick={() => setError("")}><X size={16} /></button></div>}
        {notice && <div className="studio-message success" role="status">{notice}<button aria-label="Fermer le message" onClick={() => setNotice("")}><X size={16} /></button></div>}
        <div className="workspace-grid">
          <section className="library-panel" aria-label="Sprites du thème">
            <div className="library-toolbar"><span>{visible.length} / {themeSprites.length} sprites</span><label className="search-field"><Search size={16} /><input aria-label="Rechercher un sprite" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom, race, couleur…" /></label></div>
            {animalView && <div className="library-filters" aria-label="Filtrer les animaux"><label>Espèce<select value={speciesFilter} onChange={(e) => setSpeciesFilter(e.target.value)}><option value="">Toutes les espèces</option>{availableSpecies.map((species) => <option key={species} value={species}>{animalSpeciesLabel(species)}</option>)}</select></label><label>Catégorie<select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)}><option value="">Toutes les catégories</option>{availableTags.map((tag) => <option key={tag} value={tag}>{animalCategoryLabel(tag)}</option>)}</select></label><label>Couleur<select value={colorFilter} onChange={(e) => setColorFilter(e.target.value)}><option value="">Toutes les couleurs</option>{COLORS.map((color) => <option key={color} value={color}>{ANIMAL_COLORS[color].label}</option>)}</select></label>{(search || speciesFilter || tagFilter || colorFilter) && <button className="clear-filters" onClick={() => { setSearch(""); setSpeciesFilter(""); setTagFilter(""); setColorFilter(""); }}>Effacer les filtres</button>}</div>}
            <div className="sprite-grid">{visible.map((sprite) => <button className={`sprite-card ${selected?.id === sprite.id ? "is-selected" : ""}`} key={sprite.id} disabled={busy} aria-pressed={selected?.id === sprite.id} onClick={() => { if (canLeave()) { setSelected(sprite); setNewTag(""); } }}>
              <span className="sprite-card-art">{sprite.source ? <img src={imageUrl(sprite.source)} alt="" loading="lazy" /> : <ImagePlus size={30} />}{selected?.id === sprite.id && <span className="selection-check"><Check size={12} /></span>}</span>
              <strong>{sprite.label}</strong>{sprite.breed && <span className="sprite-breed">{sprite.breed}</span>}<span className="sprite-colors" aria-label={`Couleurs : ${normalizedAnimalMetadata(sprite).dominantColors.map((color) => ANIMAL_COLORS[color].label).join(", ")}`}>{normalizedAnimalMetadata(sprite).dominantColors.map((color) => <span key={color} title={ANIMAL_COLORS[color].label} style={{ backgroundColor: ANIMAL_COLORS[color].hex }} />)}</span><span className={`sprite-status ${sprite.status}`}>{sprite.status === "ready" ? "Validé" : "Brouillon"}</span>
            </button>)}
            {themeSprites.length > 0 && <button className="sprite-add-card" disabled={busy} onClick={newSprite}><Plus size={25} /><span>Ajouter un sprite</span></button>}</div>
            {themeSprites.length === 0 && <div className="library-empty"><span>{themeIcons[theme?.category ?? "animals"]}</span><h2>Une collection à imaginer</h2><p>Ajoute un sujet, prépare son prompt puis importe ton image.</p><button className="secondary-button" disabled={busy} onClick={newSprite}><Plus size={16} /> Créer le premier sprite</button></div>}
            {themeSprites.length > 0 && !visible.length && <p className="no-results">Aucun sprite ne correspond à ta recherche.</p>}
            <div className="library-footnote"><Sparkles size={15} /><p>Un style cohérent, même en tout petit.<br /><span>Vue de face · tête seule · fond transparent</span></p></div>
          </section>

          <aside className="editor-panel" aria-label="Éditeur de sprite">
            {selected ? <>
              <div className="editor-title"><span>LE SPRITE</span><span>{dirty ? "• Non enregistré" : "Enregistré"}</span></div>
              <div className={`sprite-preview preview-${background}`}>{thumbnail ? <AnimalPortrait imageSrc={thumbnail} label={`Aperçu de ${selected.label || "ton sprite"}`} accessoryId={selectedTheme?.category === "animals" ? previewAccessory : null} size={192} /> : <div className="preview-placeholder"><ImagePlus size={36} /><p>Ton prochain personnage</p></div>}</div>
              <div className="preview-toolbar"><span>{asset ? `${asset.width} × ${asset.height} · ${asset.transparent ? "Transparent" : "Fond opaque"}` : "PNG ou WebP"}</span><div aria-label="Fond de l’aperçu">{["checker", "cream", "night"].map((bg) => <button key={bg} aria-label={`Fond ${bg === "checker" ? "damier" : bg === "cream" ? "clair" : "sombre"}`} aria-pressed={background === bg} className={`preview-swatch preview-${bg}`} onClick={() => setBackground(bg)} />)}</div></div>
              {selectedTheme?.category === "animals" && <section className="accessory-preview" aria-label="Essayer un accessoire">
                <strong>La boîte à déguisements</strong><p>Un accessoire réutilisable sur chaque animal.</p>
                <div className="accessory-options"><button type="button" aria-pressed={!previewAccessory} onClick={() => setPreviewAccessory(null)}><span className="accessory-none">∅</span>Sans accessoire</button>
                  {ACCESSORIES.map((accessory) => <button key={accessory.id} type="button" aria-pressed={previewAccessory === accessory.id} onClick={() => setPreviewAccessory(accessory.id)}><img src={accessory.imageSrc} alt="" />{accessory.label}</button>)}
                </div><p>En jeu, les tenues varient avec la difficulté. L’animal à retrouver porte le même accessoire que son portrait.</p>
              </section>}
              <label className={`upload-button ${busy ? "disabled" : ""}`}><ImagePlus size={16} /> {selected.source ? "Importer une autre image" : "Importer une image"}<input type="file" accept="image/png,image/webp" disabled={busy} aria-label="Importer une image PNG ou WebP" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); e.target.value = ""; }} /></label>
              {asset && (!asset.transparent || asset.width !== asset.height || asset.width < 128) && selectedTheme?.destination === "game" && <p className="image-advice">Pour le jeu : image carrée, transparente, de 128 px minimum. Le fond blanc reste utile comme référence.</p>}
              <form className="sprite-form" onSubmit={(e) => { e.preventDefault(); void saveSprite(); }}>
                <label>Nom affiché<input required maxLength={80} value={selected.label} disabled={busy} placeholder="Hippopotame" onChange={(e) => edit({ label: e.target.value })} /></label>
                <label>Sujet du prompt<input required maxLength={240} value={selected.subject} disabled={busy} placeholder="un hippopotame" onChange={(e) => edit({ subject: e.target.value })} /></label>
                {selectedTheme?.category === "animals" && <>
                  <label>Collection<select value={selected.themeId} disabled={busy} onChange={(e) => edit({ themeId: e.target.value })}>{state.catalog.themes.filter((t) => t.category === "animals").map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
                  <div className="form-row"><label>Espèce<input list="animal-species" maxLength={64} value={selected.species ?? ""} disabled={busy} placeholder="chat, chien, mouton…" onChange={(e) => edit({ species: slugify(e.target.value), breed: "" })} /><datalist id="animal-species">{Object.entries(ANIMAL_SPECIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</datalist></label><label>Race / variété<input list="animal-breeds" maxLength={80} value={selected.breed ?? ""} disabled={busy} placeholder="À préciser si utile" onChange={(e) => edit({ breed: e.target.value })} /><datalist id="animal-breeds">{(BREED_SUGGESTIONS[selected.species ?? ""] ?? []).map((breed) => <option key={breed} value={breed} />)}</datalist></label></div>
                  <p className="taxonomy-hint">Même espèce, races et pelages différents : des voisins plus ressemblants dans la foule. Les suggestions n’ajoutent pas de nouveaux sprites.</p>
                </>}
                <div className="form-row"><label>Couleur principale<select value={selected.color} disabled={busy} onChange={(e) => { const color = e.target.value as Sprite["color"]; edit({ color, dominantColors: [color, ...(metadata?.dominantColors ?? []).filter((c) => c !== color).slice(0, 2)] }); }}>{COLORS.map((color) => <option key={color} value={color}>{ANIMAL_COLORS[color].label}</option>)}</select></label><label>Famille visuelle<input required maxLength={64} value={selected.family} disabled={busy} placeholder="gris, tacheté, roux…" onChange={(e) => edit({ family: e.target.value })} /></label></div>
                {selectedTheme?.category === "animals" && metadata && <>
                  <fieldset className="taxonomy-fieldset"><legend>Palette dominante <span>{metadata.dominantColors.length} / 3</span></legend><div className="color-options">{COLORS.map((color) => { const active = metadata.dominantColors.includes(color); return <button key={color} type="button" aria-pressed={active} aria-label={`${ANIMAL_COLORS[color].label}${color === selected.color ? " (couleur principale)" : ""}`} title={color === selected.color ? "Couleur principale" : ANIMAL_COLORS[color].label} disabled={busy || color === selected.color || (!active && metadata.dominantColors.length >= 3)} className={`color-option ${active ? "is-active" : ""}`} onClick={() => edit({ dominantColors: active ? metadata.dominantColors.filter((c) => c !== color) : [...metadata.dominantColors, color] })}><span style={{ backgroundColor: ANIMAL_COLORS[color].hex }} />{ANIMAL_COLORS[color].label}{active && <Check size={11} />}</button>; })}</div><p>Jusqu’à trois couleurs visibles sur l’animal, sans compter ses accessoires.</p></fieldset>
                  <fieldset className="taxonomy-fieldset"><legend>Catégories <span>{metadata.tags.length} / 12</span></legend><div className="category-options">{[...new Set([...Object.keys(ANIMAL_CATEGORIES), ...metadata.tags])].map((tag) => { const active = metadata.tags.includes(tag); return <button key={tag} type="button" aria-pressed={active} disabled={busy || (!active && metadata.tags.length >= 12)} className={`category-option ${active ? "is-active" : ""}`} onClick={() => edit({ tags: active ? metadata.tags.filter((item) => item !== tag) : [...metadata.tags, tag] })}>{active && <Check size={11} />}{animalCategoryLabel(tag)}</button>; })}</div><div className="custom-category"><input aria-label="Nouvelle catégorie de l’animal" placeholder="Une autre catégorie…" maxLength={64} value={newTag} disabled={busy || metadata.tags.length >= 12} onChange={(e) => setNewTag(e.target.value)} /><button type="button" aria-label="Ajouter la catégorie" disabled={busy || metadata.tags.length >= 12 || !slugify(newTag) || metadata.tags.includes(slugify(newTag))} onClick={() => { edit({ tags: [...metadata.tags, slugify(newTag)] }); setNewTag(""); }}><Plus size={16} /></button></div><p>Un animal peut être à la ferme, domestique et appartenir à plusieurs catégories.</p></fieldset>
                </>}
                <label>État<select value={selected.status} disabled={busy} onChange={(e) => edit({ status: e.target.value as Sprite["status"] })}><option value="draft">Brouillon</option><option value="ready" disabled={!selected.source}>Validé</option></select></label>
                <label>Notes<textarea rows={2} maxLength={2000} value={selected.notes} disabled={busy} placeholder="Idées, variantes, détails à retoucher…" onChange={(e) => edit({ notes: e.target.value })} /></label>
                <button className="primary-button save-button" disabled={busy || !dirty} type="submit">{busy ? "En cours…" : "Enregistrer le sprite"}</button>
              </form>
              <details className="prompt-panel" open><summary><Sparkles size={15} /> Le prompt de création</summary><div className="prompt-options"><label><input type="checkbox" checked={transparentPrompt} onChange={(e) => setTransparentPrompt(e.target.checked)} /> Fond transparent</label><button onClick={() => void perform(async () => { await navigator.clipboard.writeText(prompt); setNotice("Prompt copié. Génère l’image dans ton outil habituel, puis importe-la ici."); })} disabled={busy}><Copy size={14} /> Copier</button></div><textarea aria-label="Prompt de création" readOnly value={prompt} rows={5} /><p>Copie le prompt dans ton outil de génération, puis importe le résultat.</p></details>
              <div className="in-game-preview"><span>À LA TAILLE DU JEU · 45 PX</span><div>{thumbnail ? Array.from({ length: 12 }, (_, index) => <AnimalPortrait key={index} imageSrc={index === 4 ? thumbnail : imageUrl(candidates[index % Math.max(1, candidates.length)]?.source ?? selected.source) ?? thumbnail} label={index === 4 ? selected.label : "Animal voisin"} size={45} accessoryId={selectedTheme?.category === "animals" ? (index === 4 || index === 1 || index === 8 ? previewAccessory : ACCESSORIES[index % ACCESSORIES.length].id) : null} />) : <p>Importe une image pour l’essayer dans la foule.</p>}</div></div>
            </> : <div className="editor-empty"><ImagePlus size={36} /><p>Sélectionne un sprite<br />ou imagine le prochain.</p></div>}
          </aside>
        </div>
      </div>
    </main>
    {creatingTheme && <div className="studio-modal-backdrop"><section className="studio-modal" role="dialog" aria-modal="true" aria-labelledby="theme-title"><button className="modal-close" disabled={busy} onClick={() => setCreatingTheme(false)} aria-label="Fermer"><X size={20} /></button><span className="eyebrow">UNE NOUVELLE COLLECTION</span><h2 id="theme-title">Créer un thème</h2><form onSubmit={(e) => { e.preventDefault(); void createTheme(); }}><label>Nom du thème<input required maxLength={80} autoFocus value={themeName} onChange={(e) => setThemeName(e.target.value)} placeholder="Les animaux de la forêt" /></label><label>Catégorie<select value={category} onChange={(e) => setCategory(e.target.value as Category)}>{Object.entries(CATEGORIES).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><p>{category === "animals" ? "Les sprites validés pourront être intégrés au jeu." : "Ce thème restera dans l’atelier, pour le fun."}</p>{error && <p role="alert" className="image-advice">{error}</p>}<button className="primary-button" disabled={busy}>Créer le thème</button></form></section></div>}
  </div>;
}
