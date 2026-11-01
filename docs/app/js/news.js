// "What's new": shown once after an update (only the changes since the last visit), and from ? → What's new.
// Add a new entry at the TOP with every web build that users should know about.
import { T, lang, store, fmtDate } from "./core.js";
import { esc, popup } from "./ui.js";
import { WEB_BUILD } from "./version.js";

export const NEWS = [
  { build: 10, date: "2026-11-01", items: {
    en: ["🧭 A step-by-step guide for new users – open it any time with ? → Guide.", "📅 Bank import: choose the dates – for example only one month of a 3-month statement."],
    pl: ["🧭 Przewodnik krok po kroku dla nowych użytkowników – otworzysz go zawsze przez ? → Przewodnik.", "📅 Import z banku: wybierz daty – np. tylko jeden miesiąc z 3-miesięcznego wyciągu."],
    de: ["🧭 Eine Schritt-für-Schritt-Anleitung für neue Nutzer – jederzeit über ? → Anleitung.", "📅 Bankimport: Zeitraum wählen – z. B. nur einen Monat aus einem 3-Monats-Auszug."],
    fr: ["🧭 Un guide pas à pas pour les nouveaux utilisateurs – à tout moment via ? → Guide.", "📅 Import bancaire : choisissez les dates – par ex. un seul mois d'un relevé de 3 mois."] } },
  { build: 9, date: "2026-11-01", items: {
    en: ["⠿ Move the cards on every tab with their handle, like in the Windows app.", "❓ Drag the ? button anywhere.", "➕ When there are many tabs, the extra ones go under \"More\"."],
    pl: ["⠿ Przesuwaj karty na każdej karcie za uchwyt, jak w aplikacji na Windows.", "❓ Przeciągnij przycisk ? w dowolne miejsce.", "➕ Gdy kart jest dużo, dodatkowe trafiają do „Więcej”."],
    de: ["⠿ Karten auf jedem Tab mit dem Griff verschieben, wie in der Windows-App.", "❓ Die ?-Taste beliebig verschieben.", "➕ Bei vielen Tabs landen die übrigen unter „Mehr“."],
    fr: ["⠿ Déplacez les cartes de chaque onglet avec leur poignée, comme dans l'application Windows.", "❓ Déplacez le bouton ? où vous voulez.", "➕ S'il y a beaucoup d'onglets, les autres passent sous « Plus »."] } },
  { build: 6, date: "2026-11-01", items: {
    en: ["👤 Your profile opens under your picture (top right).", "ℹ Version and last update in ? → About."],
    pl: ["👤 Profil otwiera się pod Twoim zdjęciem (prawy górny róg).", "ℹ Wersja i ostatnia aktualizacja w ? → O aplikacji."],
    de: ["👤 Ihr Profil öffnet sich unter Ihrem Bild (oben rechts).", "ℹ Version und letzte Aktualisierung unter ? → Über."],
    fr: ["👤 Votre profil s'ouvre sous votre photo (en haut à droite).", "ℹ Version et dernière mise à jour dans ? → À propos."] } },
  { build: 2, date: "2026-10-31", items: {
    en: ["📲 Install MoneyCompass as an app on your phone, tablet or computer – it also opens without internet.", "💾 \"Save your profile before closing?\" with the ⏻ button."],
    pl: ["📲 Zainstaluj MoneyCompass jako aplikację na telefonie, tablecie lub komputerze – działa też bez internetu.", "💾 „Zapisać profil przed zamknięciem?” przyciskiem ⏻."],
    de: ["📲 MoneyCompass als App auf Handy, Tablet oder Computer installieren – öffnet sich auch ohne Internet.", "💾 „Profil vor dem Schließen speichern?“ mit der ⏻-Taste."],
    fr: ["📲 Installez MoneyCompass comme application sur téléphone, tablette ou ordinateur – elle s'ouvre aussi sans Internet.", "💾 « Enregistrer le profil avant de fermer ? » avec le bouton ⏻."] } },
];

const SEEN = "mc-seen-build";
const seen = () => { const v = parseInt(store.get(SEEN) || "", 10); return Number.isFinite(v) ? v : null; };
export const markSeen = () => store.set(SEEN, String(WEB_BUILD));

/** True when there is news the user hasn't seen yet. New users never get it (they get the guide). */
export function hasNews(isNewUser) {
  const s = seen();
  if (isNewUser) { markSeen(); return false; }
  if (s === null) return NEWS.length > 0;      // used the app before this box existed
  return NEWS.some(n => n.build > s);
}

export function openNews(all = false, onClose) {
  const s = seen();
  const list = all || s === null ? NEWS.slice(0, all ? NEWS.length : 3) : NEWS.filter(n => n.build > s);
  const l = lang();
  popup(`<div class="box-head"><span class="box-icon go">✨</span><h2>${esc(T("What's new"))}</h2></div>
    ${list.map(n => `<div class="news"><div class="news-head"><b>${esc(T("Build {0}", n.build))}</b><span class="hint">${fmtDate(n.date)}</span></div>
      <ul>${(n.items[l] || n.items.en).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}
    <div class="box-buttons"><button class="btn go" data-close>${esc(T("OK"))}</button></div>`,
    { width: 520, cls: "box", onClose: () => { markSeen(); onClose && onClose(); } });
}
