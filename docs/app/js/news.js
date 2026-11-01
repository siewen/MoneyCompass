// "What's new": shown once after an update (only the changes since the last visit), and from ? → What's new.
// Add a new entry at the TOP with every web build that users should know about.
import { T, lang, store, fmtDate, State, save } from "./core.js";
import { esc, popup } from "./ui.js";
import { WEB_BUILD } from "./version.js";

export const NEWS = [
  { build: 25, date: "2026-11-01", items: {
    en: ["🔁 Repeating expenses show \"🔁 Monthly\" in their line.", "🏦 Regular deposits to My savings can say from which account they come (e.g. another bank).", "⬆ Bank import: mark a transfer to savings as \"Savings – every month\" – it becomes a regular deposit in the Payment calendar.", "📅 The Payment calendar starts with the oldest month of your data: before today it shows what really happened, from today what is planned. \"Today\" jumps to this month.", "ⓘ Imported entries have an info button with the details from your bank: your account, the other side's name and account, the title.", "🌐 Choose the language with the 🌐 button at the top and in the guide.", "❎ Closing the window with the X: if you changed something since the last profile file, the browser asks first. Your entries always stay in this browser."],
    pl: ["🔁 Powtarzające się wydatki pokazują „🔁 Co miesiąc” w swoim wierszu.", "🏦 Przy regularnych wpłatach na oszczędności możesz podać, z jakiego konta pochodzą (np. z innego banku).", "⬆ Import z banku: oznacz przelew na oszczędności jako „Oszczędności – co miesiąc” – stanie się regularną wpłatą w kalendarzu płatności.", "📅 Kalendarz płatności zaczyna się od najstarszego miesiąca Twoich danych: przed dziś pokazuje, co naprawdę się wydarzyło, od dziś – co jest zaplanowane. „Dziś” przenosi do bieżącego miesiąca.", "ⓘ Zaimportowane wpisy mają przycisk informacji ze szczegółami z banku: Twoje konto, nazwa i konto kontrahenta, tytuł.", "🌐 Wybierz język przyciskiem 🌐 na górze oraz w przewodniku.", "❎ Zamykanie okna przez X: jeśli coś zmieniłeś od ostatniego pliku profilu, przeglądarka najpierw zapyta. Twoje wpisy zawsze zostają w tej przeglądarce."],
    de: ["🔁 Wiederkehrende Ausgaben zeigen „🔁 Monatlich“ in ihrer Zeile.", "🏦 Bei regelmäßigen Einzahlungen in Meine Ersparnisse lässt sich angeben, von welchem Konto sie kommen (z. B. andere Bank).", "⬆ Bankimport: eine Sparüberweisung als „Sparen – jeden Monat“ markieren – sie wird zur regelmäßigen Einzahlung im Zahlungskalender.", "📅 Der Zahlungskalender beginnt mit dem ältesten Monat Ihrer Daten: vor heute zeigt er, was wirklich passiert ist, ab heute, was geplant ist. „Heute“ springt zum aktuellen Monat.", "ⓘ Importierte Einträge haben einen Info-Knopf mit den Details der Bank: Ihr Konto, Name und Konto der Gegenseite, Verwendungszweck.", "🌐 Sprache mit dem 🌐-Knopf oben und im Leitfaden wählen.", "❎ Fenster mit dem X schließen: Wenn sich seit der letzten Profildatei etwas geändert hat, fragt der Browser zuerst. Ihre Einträge bleiben immer in diesem Browser."],
    fr: ["🔁 Les dépenses récurrentes affichent « 🔁 Mensuel » dans leur ligne.", "🏦 Les versements réguliers vers Mon épargne peuvent indiquer de quel compte ils viennent (par ex. une autre banque).", "⬆ Import bancaire : marquez un virement d'épargne comme « Épargne – chaque mois » – il devient un versement régulier dans le calendrier des paiements.", "📅 Le calendrier des paiements commence au mois le plus ancien de vos données : avant aujourd'hui, ce qui s'est vraiment passé, à partir d'aujourd'hui, ce qui est prévu. « Aujourd'hui » revient au mois en cours.", "ⓘ Les opérations importées ont un bouton d'info avec les détails de la banque : votre compte, le nom et le compte de l'autre partie, le libellé.", "🌐 Choisissez la langue avec le bouton 🌐 en haut et dans le guide.", "❎ Fermer la fenêtre avec le X : si vous avez modifié quelque chose depuis le dernier fichier de profil, le navigateur demande d'abord. Vos saisies restent toujours dans ce navigateur."] } },
  { build: 24, date: "2026-11-01", items: {
    en: ["🗑 Deleted items: at the bottom of each tab you see what you deleted – put it back with ↩ Restore."],
    pl: ["🗑 Usunięte pozycje: na dole każdej karty widzisz, co usunięto – przywróć to przyciskiem ↩ Przywróć."],
    de: ["🗑 Gelöschte Einträge: unten auf jedem Tab sehen Sie, was Sie gelöscht haben – mit ↩ Wiederherstellen zurückholen."],
    fr: ["🗑 Éléments supprimés : en bas de chaque onglet, voyez ce que vous avez supprimé – remettez-le avec ↩ Restaurer."] } },
  { build: 23, date: "2026-11-01", items: {
    en: ["🎨 Expenses: coloured buttons – blue 🔁 repeat (bright when on), amber ✎ edit (with a light background when you changed the expense), red 🗑 delete."],
    pl: ["🎨 Wydatki: kolorowe przyciski – niebieskie 🔁 powtarzanie (jasne, gdy włączone), bursztynowa ✎ edycja (z jasnym tłem, gdy wydatek został zmieniony), czerwone 🗑 usuwanie."],
    de: ["🎨 Ausgaben: farbige Schaltflächen – blau 🔁 Wiederholung (kräftig, wenn an), bernstein ✎ Bearbeiten (mit hellem Hintergrund, wenn Sie die Ausgabe geändert haben), rot 🗑 Löschen."],
    fr: ["🎨 Dépenses : boutons en couleur – bleu 🔁 répétition (vif quand activé), ambre ✎ modifier (fond clair quand vous avez modifié la dépense), rouge 🗑 supprimer."] } },
  { build: 22, date: "2026-11-01", items: {
    en: ["📊 Clearer charts: \"Your expenses\" shows from which date to which date it counts, and the current month is marked as not finished (planned income, expenses so far)."],
    pl: ["📊 Czytelniejsze wykresy: „Twoje wydatki” pokazują, od której do której daty są liczone, a bieżący miesiąc jest oznaczony jako niezakończony (dochody zaplanowane, wydatki do tej pory)."],
    de: ["📊 Klarere Diagramme: „Ihre Ausgaben“ zeigt, von welchem bis zu welchem Datum gerechnet wird, und der laufende Monat ist als nicht abgeschlossen markiert (geplante Einnahmen, bisherige Ausgaben)."],
    fr: ["📊 Graphiques plus clairs : « Vos dépenses » indique de quelle date à quelle date elles sont comptées, et le mois en cours est marqué comme non terminé (revenus prévus, dépenses jusqu'ici)."] } },
  { build: 20, date: "2026-11-01", items: {
    en: ["🔁 Expenses can repeat: choose \"Repeats\" when adding an expense, or click 🔁 next to it – it then appears every month in the Payment calendar.", "🏦 My savings: add a regular deposit (standing order) to a savings entry – it appears automatically as \"To savings\" in the Payment calendar."],
    pl: ["🔁 Wydatki mogą się powtarzać: wybierz „Powtarzanie” przy dodawaniu wydatku albo kliknij 🔁 obok niego – pojawi się co miesiąc w kalendarzu płatności.", "🏦 Moje oszczędności: dodaj regularną wpłatę (zlecenie stałe) – pojawi się automatycznie jako „Na oszczędności” w kalendarzu płatności."],
    de: ["🔁 Ausgaben können sich wiederholen: beim Hinzufügen „Wiederholung“ wählen oder daneben auf 🔁 klicken – sie erscheinen dann jeden Monat im Zahlungskalender.", "🏦 Meine Ersparnisse: eine regelmäßige Einzahlung (Dauerauftrag) hinzufügen – sie erscheint automatisch als „Zum Sparen“ im Zahlungskalender."],
    fr: ["🔁 Les dépenses peuvent se répéter : choisissez « Répétition » en ajoutant une dépense, ou cliquez sur 🔁 à côté – elle apparaît alors chaque mois dans le calendrier des paiements."] } },
  { build: 19, date: "2026-11-01", items: {
    en: ["📅 New module \"Payment calendar\" (Pro): salary, bills, subscriptions and savings transfers in a calendar, with a preview of the next 1, 3, 6 or 12 months. Switch it on in Options → Modules.", "💡 It finds payments that come back every month in your expenses – add them with one click.", "⠿ Wide cards like \"Comparison\" can be moved too.", "💰 Income: enter your gross salary and MoneyCompass estimates the net (Poland, employment contract) – you can always correct it.", "⏸ Switch income and regular payments on or off, and give regular payments a last payment date.", "🔄 Compare offers shows when the bank offers were last updated.", "🏦 Mon épargne : ajoutez un versement régulier (virement permanent) – il apparaît automatiquement comme « Vers l'épargne » dans le calendrier des paiements."],
    pl: ["📅 Nowy moduł „Kalendarz płatności” (Pro): pensja, rachunki, subskrypcje i przelewy na oszczędności w kalendarzu, z podglądem na 1, 3, 6 lub 12 miesięcy. Włącz go w Opcje → Moduły.", "💡 Znajduje w wydatkach płatności powtarzające się co miesiąc – dodasz je jednym kliknięciem.", "⠿ Szerokie karty, jak „Porównanie”, też można przesuwać.", "💰 Dochody: wpisz wynagrodzenie brutto, a MoneyCompass oszacuje netto (Polska, umowa o pracę) – zawsze możesz je poprawić.", "⏸ Włączaj i wyłączaj dochody oraz stałe płatności, a stałym płatnościom ustaw datę ostatniej płatności.", "🔄 Porównaj oferty pokazuje, kiedy ostatnio zaktualizowano oferty banków."],
    de: ["📅 Neues Modul „Zahlungskalender“ (Pro): Gehalt, Rechnungen, Abos und Sparüberweisungen in einem Kalender, mit Vorschau auf 1, 3, 6 oder 12 Monate. Einschalten unter Optionen → Module.", "💡 Findet in Ihren Ausgaben Zahlungen, die jeden Monat wiederkommen – mit einem Klick hinzufügen.", "⠿ Auch breite Karten wie „Vergleich“ lassen sich verschieben.", "💰 Einkommen: Bruttogehalt eingeben, MoneyCompass schätzt das Netto (Polen, Arbeitsvertrag) – jederzeit korrigierbar.", "⏸ Einkommen und regelmäßige Zahlungen ein- und ausschalten, und für regelmäßige Zahlungen ein letztes Zahlungsdatum setzen.", "🔄 Angebote vergleichen zeigt, wann die Bankangebote zuletzt aktualisiert wurden."],
    fr: ["📅 Nouveau module « Calendrier des paiements » (Pro) : salaire, factures, abonnements et virements d'épargne dans un calendrier, avec un aperçu sur 1, 3, 6 ou 12 mois. À activer dans Options → Modules.", "💡 Il repère dans vos dépenses les paiements qui reviennent chaque mois – ajoutez-les en un clic.", "⠿ Les cartes larges comme « Comparaison » peuvent aussi être déplacées."] } },
  { build: 18, date: "2026-11-01", items: {
    en: ["🏦 Compare offers: today's best savings accounts and deposits are calculated for your amount – with the difference to your own offer and one click to add them.", "💰 Revenus : saisissez votre salaire brut et MoneyCompass estime le net (Pologne, contrat de travail) – vous pouvez toujours le corriger.", "⏸ Activez ou désactivez revenus et paiements réguliers, et donnez une date de dernier paiement aux paiements réguliers.", "🔄 Comparer les offres indique quand les offres bancaires ont été mises à jour."],
    pl: ["🏦 Porównaj oferty: dzisiejsze najlepsze konta oszczędnościowe i lokaty przeliczone dla Twojej kwoty – z różnicą względem Twojej oferty i dodawaniem jednym kliknięciem."],
    de: ["🏦 Angebote vergleichen: die besten Sparkonten und Festgelder von heute, berechnet für Ihren Betrag – mit dem Unterschied zu Ihrem Angebot und Hinzufügen per Klick."],
    fr: ["🏦 Comparer les offres : les meilleurs comptes d'épargne et dépôts du jour calculés pour votre montant – avec l'écart par rapport à votre offre et ajout en un clic."] } },
  { build: 14, date: "2026-11-01", items: {
    en: ["🏦 Compare offers: fill in an offer from My savings with one click, to see what your money earns now compared with other banks."],
    pl: ["🏦 Porównaj oferty: uzupełnij ofertę z Moich oszczędności jednym kliknięciem i zobacz, ile Twoje pieniądze zarabiają teraz w porównaniu z innymi bankami."],
    de: ["🏦 Angebote vergleichen: ein Angebot mit einem Klick aus Meine Ersparnisse ausfüllen – und sehen, was Ihr Geld jetzt im Vergleich zu anderen Banken bringt."],
    fr: ["🏦 Comparer les offres : remplissez une offre depuis Mon épargne en un clic, pour voir ce que rapporte votre argent par rapport aux autres banques."] } },
  { build: 12, date: "2026-11-01", items: {
    en: ["⠿ Moving cards is easier: drag a card by its title or its handle – the page scrolls by itself when you reach the edge."],
    pl: ["⠿ Łatwiejsze przesuwanie kart: przeciągnij kartę za tytuł lub uchwyt – strona sama się przewija przy krawędzi."],
    de: ["⠿ Karten leichter verschieben: am Titel oder Griff ziehen – die Seite scrollt am Rand von selbst."],
    fr: ["⠿ Déplacer les cartes est plus simple : faites glisser une carte par son titre ou sa poignée – la page défile toute seule au bord."] } },
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
  if (isNewUser || State.data.Settings.NewsHidden) { markSeen(); return false; }
  if (s === null) return NEWS.length > 0;      // used the app before this box existed
  return NEWS.some(n => n.build > s);
}

export function openNews(all = false, onClose) {
  const s = seen();
  const list = all || s === null ? NEWS.slice(0, all ? NEWS.length : 3) : NEWS.filter(n => n.build > s);
  const l = lang();
  const box = popup(`<div class="box-head"><span class="box-icon go">✨</span><h2>${esc(T("What's new"))}</h2></div>
    ${list.map(n => `<div class="news"><div class="news-head"><b>${esc(T("Build {0}", n.build))}</b><span class="hint">${fmtDate(n.date)}</span></div>
      <ul>${(n.items[l] || n.items.en).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>`).join("")}
    <div class="box-buttons"><button class="btn go" data-close>${esc(T("OK"))}</button></div>
    <label class="check"><input type="checkbox" name="newsoff"${State.data.Settings.NewsHidden ? " checked" : ""}><span>${esc(T("Don't show what's new after updates"))}</span></label>
    <p class="hint">${esc(T("You can switch it back on in Options → Backup & restore, and always find it in ? → About."))}</p>`,
    { width: 520, cls: "box", onClose: () => {
        const off = box.el.querySelector('[name="newsoff"]').checked;
        if (off !== !!State.data.Settings.NewsHidden) { State.data.Settings.NewsHidden = off; save(); }
        markSeen(); onClose && onClose(); } });
}
