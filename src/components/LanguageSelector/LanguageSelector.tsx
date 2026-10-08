import { useId, useRef, useState } from "react";
import { Check, ChevronDown, Globe2, X } from "lucide-react";
import { useTranslation } from "../../i18n";
import { LANGUAGES, LANGUAGE_OPTIONS, localeDirection } from "../../i18n/locales";
import { useLanguageStore } from "../../i18n/store";
import "./LanguageSelector.css";

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, t } = useTranslation();
  const setLocale = useLanguageStore(state => state.setLocale);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const dialogId = useId();
  const selected = LANGUAGES.find(language => language.code === locale)!;

  function showLanguages() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    setOpen(true);
    dialog.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }

  return <div className={`language-selector${compact ? " language-selector--compact" : ""}`}>
    {!compact && <span className="language-selector-label"><Globe2 size={24} aria-hidden="true" />{t("Langue")}</span>}
    <button type="button" className="language-selector-trigger" onClick={showLanguages}
      aria-label={`${t("Langue")} : ${selected.label}`} aria-haspopup="dialog"
      aria-expanded={open} aria-controls={dialogId}>
      <img className="language-selector-flag" src={selected.flag} alt="" draggable={false} />
      <span lang={selected.tag} dir={localeDirection(locale)}>{selected.label}</span>
      <ChevronDown className="language-selector-chevron" size={16} aria-hidden="true" />
    </button>

    <dialog ref={dialogRef} id={dialogId} className="language-dialog" aria-labelledby={titleId}
      onClose={() => setOpen(false)} onClick={event => {
        if (event.target === event.currentTarget) dialogRef.current?.close();
      }}>
      <div className="language-dialog-panel">
        <div className="language-dialog-header">
          <span className="language-dialog-globe"><Globe2 size={26} aria-hidden="true" /></span>
          <h2 id={titleId}>{t("Langue")}</h2>
          <button type="button" className="language-dialog-close" aria-label={t("Retour")}
            onClick={() => dialogRef.current?.close()}><X size={21} aria-hidden="true" /></button>
        </div>
        <ul className="language-dialog-options" aria-labelledby={titleId}>
          {LANGUAGE_OPTIONS.map(language => <li key={language.code}>
            <button type="button" className="language-option" aria-pressed={locale === language.code}
              onClick={() => {
                setLocale(language.code);
                dialogRef.current?.close();
              }}>
              <img src={language.flag} alt="" draggable={false} />
              <span lang={language.tag} dir={localeDirection(language.code)}>
                {language.code === "zh" ? <>中文<wbr />（简体）</> : language.label}
              </span>
              {locale === language.code && <Check className="language-option-check" size={13} strokeWidth={3} aria-hidden="true" />}
            </button>
          </li>)}
        </ul>
      </div>
    </dialog>
  </div>;
}
