import { ico } from "./nw.js";
// "What's new": shown once after an update (only the changes since the last visit), and from ? → What's new.
// Add a new entry at the TOP with every web build that users should know about.
import { T, lang, store, fmtDate, State, save } from "./core.js";
import { esc, popup } from "./ui.js";
import { WEB_BUILD } from "./version.js";

export const NEWS = [
  { build: 100, date: "2026-11-08", items: {
    en: ["✨ The Import window is a little bigger again."],
    pl: ["✨ Okno importu jest nieco większe."],
  } },
  { build: 99, date: "2026-11-08", items: {
    en: ["✨ The Import window is smaller: it fits on one screen without scrolling."],
    pl: ["✨ Okno importu jest mniejsze i mieści się na ekranie bez przewijania."],
  } },
  { build: 98, date: "2026-11-08", items: {
    en: ["✨ About MoneyCompass is back in the user menu (below Help)."],
    pl: ["✨ „About” wróciło do menu użytkownika."],
  } },
  { build: 97, date: "2026-11-08", items: {
    en: ["✨ Supported banks in the Import window now show a bank icon."],
    pl: ["✨ Obsługiwane banki w oknie importu mają ikonę banku."],
  } },
  { build: 96, date: "2026-11-08", items: {
    en: ["✨ Import window closer to the design: solid glowing icons, chips with icons and a Privacy Protected badge."],
    pl: ["✨ Okno importu bliższe projektowi: pełne ikony, znaczniki z ikonami i plakietka prywatności."],
  } },
  { build: 95, date: "2026-11-08", items: {
    en: ["✨ New Export window (what to export, date range, Excel/PDF/Word), new Income Management page and new Import window, all in the new design."],
    pl: ["✨ Nowe okna Eksportu i Importu oraz nowa strona Przychodów w nowym wyglądzie."],
  } },
  { build: 94, date: "2026-11-08", items: {
    en: ["✨ The user menu is now compact."],
    pl: ["✨ Menu użytkownika jest teraz mniejsze."],
  } },
  { build: 93, date: "2026-11-08", items: {
    en: ["✨ Profile picture placeholder now in emerald green, matching the design."],
    pl: ["✨ Awatar profilu w kolorze szmaragdowym."],
  } },
  { build: 92, date: "2026-11-08", items: {
    en: ["✨ User menu redesigned (My Profile, Accounts, Categories, Language, Backup & Restore, Help, Sign Out). In the installed app, Sign Out closes MoneyCompass again."],
    pl: ["✨ Nowe menu użytkownika. W zainstalowanej aplikacji „Sign Out” zamyka MoneyCompass."],
  } },
  { build: 91, date: "2026-11-08", items: {
    en: ["✨ New installs get the new compass icon automatically, and apps installed earlier update their icon by themselves."],
    pl: ["✨ Nowa ikona instaluje się automatycznie; wcześniej zainstalowane aplikacje aktualizują ikonę same."],
  } },
  { build: 90, date: "2026-11-08", items: {
    en: ["✨ The installed app and home-screen icon now use the new compass logo."],
    pl: ["✨ Ikona zainstalowanej aplikacji używa nowego logo."],
  } },
  { build: 89, date: "2026-11-08", items: {
    en: ["✨ Import, Export, notifications and the user menu now sit at the far right of the top bar; Settings is at the very bottom of the side menu."],
    pl: ["✨ Import, Eksport i menu użytkownika po prawej; Ustawienia na dole menu."],
  } },
  { build: 88, date: "2026-11-08", items: {
    en: ["✨ New side menu (bigger icons, Savings Goals, private-data note) and a new user menu: My Profile, Accounts, Categories, Preferences, Language, Subscription, Backup & Restore, Help, Sign Out."],
    pl: ["✨ Nowe menu boczne i nowe menu użytkownika."],
  } },
  { build: 87, date: "2026-11-08", items: {
    en: ["✨ Overview redesigned to match the new design: new compass logo, icon cards with the change against the previous month, bar and trend charts, category and savings donuts, Budget Plan, Emergency Fund, Loans and Goals cards, plus Add Transaction and a notification bell."],
    pl: ["✨ Nowy wygląd Przeglądu: nowe logo, karty z ikonami, wykresy, Dodaj transakcję i dzwonek powiadomień."],
  } },
  { build: 86, date: "2026-11-08", items: {
    en: ["✨ New look for the Overview: new compass logo, a fixed side menu with Reports and Settings, a top bar with search, Import, Export and your profile, a greeting, and income, spending, left over and savings rate with the change against the previous month."],
    pl: ["✨ Nowy wygląd Przeglądu: nowe logo, stałe menu boczne, pasek wyszukiwania, powitanie i zmiana względem poprzedniego miesiąca."],
  } },
  { build: 85, date: "2026-11-03", items: {
    en: ["🛡️ Automatic backup: clearer message after a browser restart. The backup stays on – the browser only asks once for permission. Choose \"Allow on every visit\" and it won't ask again."],
    pl: ["🛡️ Automatyczna kopia: jaśniejszy komunikat po ponownym uruchomieniu przeglądarki. Kopia pozostaje włączona – przeglądarka tylko raz prosi o zgodę. Wybierz „Zezwalaj przy każdej wizycie”, a nie zapyta ponownie."],
  } },
  { build: 84, date: "2026-11-03", items: {
    en: ["⬆ Import centre simplified: current account (everything, expenses only, income only) and savings account statements."],
    pl: ["⬆ Uproszczone centrum importu: konto osobiste (wszystko, tylko wydatki, tylko dochody) i wyciągi z kont oszczędnościowych."],
  } },
  { build: 83, date: "2026-11-03", items: {
    en: ["🧭 New Getting started guide: steps on the left, a progress ring, and a quick form in each step – enter your salary, an expense, your essential costs or a savings account right in the guide. Live checklist and all import options per step.", "⬆ New import centre (Import button): drop a file and it is recognised automatically, or choose what to import – everything from a current account, expenses only, income only, a savings account statement or a crypto platform (Nexo). The bank import preview can also switch between Everything, Outflows only and Inflows only."],
    pl: ["🧭 Nowy przewodnik „Pierwsze kroki”: kroki po lewej, pierścień postępu i szybki formularz w każdym kroku – wpisz wynagrodzenie, wydatek, niezbędne koszty lub konto oszczędnościowe bezpośrednio w przewodniku. Lista kontrolna na żywo i wszystkie opcje importu przy każdym kroku.", "⬆ Nowe centrum importu (przycisk Import): upuść plik, a zostanie rozpoznany automatycznie, albo wybierz, co zaimportować – wszystko z konta osobistego, tylko wydatki, tylko dochody, wyciąg z konta oszczędnościowego lub platformę krypto (Nexo). W podglądzie importu bankowego można też przełączać: Wszystko, Tylko wydatki, Tylko wpływy."],
  } },
  { build: 82, date: "2026-11-03", items: {
    en: ["📈 Savings chart per account: deposits, withdrawals, interest and fees follow the accounts you show. Hide an account (click its name) and its movements disappear too; the figures at the top then show only the accounts you see."],
    pl: ["📈 Wykres oszczędności według kont: wpłaty, wypłaty, odsetki i opłaty dotyczą pokazanych kont. Ukryj konto (kliknij jego nazwę), a znikną też jego operacje; liczby u góry pokazują wtedy tylko widoczne konta."],
  } },
  { build: 81, date: "2026-11-03", items: {
    en: ["📅 Savings imports month by month: deposits and withdrawals per month next to the closing balance, interest and fees – in the import preview (also Nexo) and in Statement analyses (button \"Month by month\")."],
    pl: ["📅 Importy oszczędności miesiąc po miesiącu: wpłaty i wypłaty w każdym miesiącu obok salda końcowego, odsetek i opłat – w podglądzie importu (także Nexo) i w Analizach wyciągów (przycisk „Miesiąc po miesiącu”)."],
  } },
  { build: 80, date: "2026-11-03", items: {
    en: ["🛠 Nexo import fixed: when no dollar exchange rate was set yet, the monthly balances, interest and rate were saved as 0. It now takes today's NBP rate automatically – please import your Nexo file again."],
    pl: ["🛠 Poprawiono import z Nexo: gdy kurs dolara nie był jeszcze ustawiony, salda miesięczne, odsetki i oprocentowanie zapisywały się jako 0. Teraz automatycznie pobierany jest dzisiejszy kurs NBP – zaimportuj plik z Nexo ponownie."],
  } },
  { build: 79, date: "2026-11-03", items: {
    en: ["💰 Your savings (Overview) per account: choose \"All accounts\" or one account. The bars show the balance at each month end with the amount and the monthly change; combined, each account has its own colour."],
    pl: ["💰 Twoje oszczędności (Przegląd) według kont: wybierz „Wszystkie konta” lub jedno konto. Słupki pokazują saldo na koniec każdego miesiąca z kwotą i zmianą miesięczną; łącznie każde konto ma swój kolor."],
  } },
  { build: 78, date: "2026-11-03", items: {
    en: ["💱 Main currency: choose PLN, EUR or USD in Settings – all amounts follow it. Changing it converts your whole profile once at today's NBP rate.", "⚙ \"Options\" is now called \"Settings\".", "📈 The Investments module was taken out of MoneyCompass; it will become its own app. The Nexo import to Savings stays."],
    pl: ["💱 Waluta główna: wybierz PLN, EUR lub USD w Ustawieniach – wszystkie kwoty się do niej dostosują. Zmiana przelicza jednorazowo cały profil po dzisiejszym kursie NBP.", "⚙ „Opcje” nazywają się teraz „Ustawienia”.", "📈 Moduł Inwestycje został wydzielony z MoneyCompass – powstanie z niego osobna aplikacja. Import z Nexo do Oszczędności pozostaje."],
  } },
  { build: 77, date: "2026-11-03", items: {
    en: ["📈 Nexo import now works like a bank savings statement: the balance at the end of every month since your first transaction, credits, debits, interest earned and fees & charges – in the Savings chart and as a statement analysis. The extra import card in Savings is gone – use the button at the top right."],
    pl: ["📈 Import z Nexo działa teraz jak wyciąg z konta oszczędnościowego: saldo na koniec każdego miesiąca od pierwszej transakcji, wpływy, wypływy, zarobione odsetki oraz opłaty i prowizje – na wykresie w Oszczędnościach i jako analiza wyciągu. Dodatkowa karta importu w Oszczędnościach zniknęła – użyj przycisku w prawym górnym rogu."],
  } },
  { build: 76, date: "2026-11-03", items: {
    en: ["🏷️ Edit your own categories: change the name, icon or \"essential\" (✎) or delete them (🗑) – via \"Edit categories…\" next to the category, or at the bottom of every category list. A new name follows into all expenses, budgets, regular payments and learned shops."],
    pl: ["🏷️ Edytuj własne kategorie: zmień nazwę, ikonę lub „niezbędne” (✎) albo je usuń (🗑) – przez „Edytuj kategorie…” obok kategorii lub na dole każdej listy kategorii. Nowa nazwa przenosi się do wszystkich wydatków, budżetów, płatności cyklicznych i zapamiętanych sklepów."],
  } },
  { build: 75, date: "2026-11-03", items: {
    en: ["🏦 Nexo import: drop your Nexo transaction export (CSV) – MoneyCompass shows your coins, today's value, the interest you earned and the interest paid on the credit line, and saves it as one savings account in Savings (Inflows and Outflows are not touched).", "📊 Loans & debts: a new chart at the top – outstanding principal, principal repaid and interest paid (the lender's income) month by month until you're debt-free, with the total cost of credit. The Overview shows the interest paid too.", "💾 Import previews show the closing balance at the top and a clear \"Save to Savings\" bar at the bottom – closing without saving asks first."],
    pl: ["🏦 Import z Nexo: upuść eksport transakcji z Nexo (CSV) – MoneyCompass pokaże Twoje kryptowaluty, dzisiejszą wartość, zarobione odsetki i odsetki zapłacone od linii kredytowej, i zapisze to jako jedno konto oszczędnościowe w Oszczędnościach (Wpływy i Wydatki pozostają bez zmian).", "📊 Kredyty i długi: nowy wykres na górze – kapitał pozostały do spłaty, spłacony kapitał i zapłacone odsetki (dochód kredytodawcy) miesiąc po miesiącu aż do spłaty, z całkowitym kosztem kredytu. Przegląd też pokazuje zapłacone odsetki.", "💾 Podglądy importu pokazują saldo końcowe na górze i wyraźny pasek „Zapisz w Oszczędnościach” na dole – zamknięcie bez zapisu najpierw pyta."],
  } },
  { build: 74, date: "2026-11-03", items: {
    en: ["📈 Investments (Pro, in development) grows: cards for XTB, Revolut, eToro, Bybit and Binance (with an important note on Binance in Poland), coins with live prices and your average buying price, a value line, regular investing per month, and a tax estimate (PIT-38) with the main rules. Your investments now count as risky money in the Overview and Savings."],
    pl: ["📈 Inwestycje (Pro, w budowie) się rozwijają: karty XTB, Revolut, eToro, Bybit i Binance (z ważną informacją o Binance w Polsce), kryptowaluty z bieżącymi cenami i średnią ceną zakupu, linia wartości, regularne inwestowanie miesięcznie oraz szacunek podatku (PIT-38) z najważniejszymi zasadami. Twoje inwestycje liczą się teraz jako pieniądze z ryzykiem w Przeglądzie i Oszczędnościach."],
  } },
  { build: 73, date: "2026-11-02", items: {
    en: ["📈 New module (Pro, in development): Investments – one card per crypto platform or broker, starting with Nexo: what it offers, the key facts and a link, plus your own position with your return in % (▲ rising / ▼ falling). Switch it on in Options → Modules. Importing crypto and trading accounts is in preparation."],
    pl: ["📈 Nowy moduł (Pro, w budowie): Inwestycje – jedna karta na platformę krypto lub brokera, na początek Nexo: co oferuje, najważniejsze informacje i link oraz Twoja pozycja ze stopą zwrotu w % (▲ rośnie / ▼ spada). Włącz go w Opcje → Moduły. Import kont krypto i tradingowych jest w przygotowaniu."],
  } },
  { build: 72, date: "2026-11-02", items: {
    en: ["📐 More compact everywhere: regular payments folded by category, outflow history folded by month, long explanations behind ⓘ or cut to two lines (click to read), no scrollbars. \"Your savings\" on the Overview now shows your balance at each month end, the change and the net interest earned. Languages moved to the bottom of the menu."],
    pl: ["📐 Wszędzie bardziej zwięźle: płatności cykliczne zwinięte według kategorii, historia wydatków według miesięcy, długie wyjaśnienia pod ⓘ lub skrócone do dwóch linii (kliknij, aby przeczytać), bez pasków przewijania. „Twoje oszczędności” w Przeglądzie pokazują saldo na koniec każdego miesiąca, zmianę i odsetki netto. Języki przeniesione na dół menu."],
  } },
  { build: 71, date: "2026-11-02", items: {
    en: ["📱 Lighter on older phones and tablets (Android 9 or older, or little memory): no blur effects and lighter graphics, so Chrome doesn't close. The lock screen now hides your finances completely instead of blurring them."],
    pl: ["📱 Lżej na starszych telefonach i tabletach (Android 9 lub starszy albo mało pamięci): bez efektów rozmycia i z lżejszą grafiką, aby Chrome się nie zamykał. Ekran blokady całkowicie ukrywa teraz Twoje finanse zamiast je rozmywać."],
  } },
  { build: 70, date: "2026-11-02", items: {
    en: ["📐 Better use of space: cards are spread evenly over the columns (a measuring bug put too many in one column), no more big empty cards, and imported inflows are much shorter – the bank's long text on two lines, the choice below it."],
    pl: ["📐 Lepsze wykorzystanie miejsca: karty są równo rozłożone w kolumnach (błąd pomiaru wkładał zbyt wiele do jednej), koniec z dużymi pustymi kartami, a zaimportowane wpływy są dużo krótsze – długi opis banku w dwóch liniach, wybór pod nim."],
  } },
  { build: 69, date: "2026-11-02", items: {
    en: ["📘 Guide and Help updated: smart import, savings statements, the health check and personal plan, Reports, and a new step \"Protect your data\" (PIN, fingerprint/face, automatic backup)."],
    pl: ["📘 Zaktualizowany przewodnik i pomoc: inteligentny import, wyciągi oszczędnościowe, kontrola finansowego zdrowia i osobisty plan, raporty oraz nowy krok „Chroń swoje dane” (PIN, odcisk palca/twarz, automatyczna kopia)."],
  } },
  { build: 68, date: "2026-11-02", items: {
    en: ["🧭 Optimize my finances is much smarter: a financial health check (savings rate, 50/30/20, housing, loans, emergency fund, interest), concrete tips per category – smoking, alcohol, shopping, groceries, eating out, subscriptions, fuel, energy, phone, car insurance, clothes, crypto – and alerts for rising spending, many small payments, goals, promotions, fees, IKZE tax savings and more."],
    pl: ["🧭 Optymalizuj moje finanse jest dużo mądrzejsze: kontrola finansowego zdrowia (stopa oszczędności, 50/30/20, mieszkanie, kredyty, poduszka finansowa, oprocentowanie), konkretne wskazówki dla kategorii – palenie, alkohol, zakupy, spożywcze, jedzenie na mieście, subskrypcje, paliwo, energia, telefon, ubezpieczenie auta, ubrania, krypto – oraz alerty o rosnących wydatkach, wielu drobnych płatnościach, celach, promocjach, opłatach, uldze IKZE i więcej."],
  } },
  { build: 67, date: "2026-11-02", items: {
    en: ["🎨 Overview: \"Outflows by category\" also shows every category with its own colour, like the Outflows tab."],
    pl: ["🎨 Przegląd: „Wydatki według kategorii” też pokazuje każdą kategorię w jej własnym kolorze, jak zakładka Wydatki."],
  } },
  { build: 66, date: "2026-11-02", items: {
    en: ["🎨 Outflows by category: every category now has its own colour in the ring and in the list – no more grey \"Everything else\" slice."],
    pl: ["🎨 Wydatki według kategorii: każda kategoria ma teraz własny kolor na wykresie i na liście – koniec z szarym kawałkiem „Wszystko inne”."],
  } },
  { build: 65, date: "2026-11-02", items: {
    en: ["🏦 Outflows → click \"Loan payments\": your loans and mortgages from the Loans & debts tab are now listed with their monthly payment (click one to open it)."],
    pl: ["🏦 Wydatki → kliknij „Raty kredytów”: Twoje kredyty i hipoteki z zakładki Kredyty i długi są teraz wymienione z miesięczną ratą (kliknij, aby otworzyć)."],
  } },
  { build: 64, date: "2026-11-02", items: {
    en: ["✨ Calmer Overview: your suggestions and \"Optimize my finances\" in one card, one monthly chart instead of three, explanations behind a small ⓘ (tap it on a phone), and clean headings without emoji. Reports are in the Reports tab."],
    pl: ["✨ Spokojniejszy Przegląd: sugestie i „Optymalizuj moje finanse” w jednej karcie, jeden wykres miesięczny zamiast trzech, wyjaśnienia pod małym ⓘ (na telefonie dotknij) i czyste nagłówki bez emoji. Raporty są w zakładce Raporty."],
  } },
  { build: 63, date: "2026-11-02", items: {
    en: ["🔒 Saved profile files are now always encrypted (.mcbak) and can't be read in Notepad. Set a password for profile files in Options so that only you can open them. Older .json files still load."],
    pl: ["🔒 Zapisane pliki profilu są teraz zawsze szyfrowane (.mcbak) i nie da się ich odczytać w Notatniku. Ustaw hasło do plików profilu w Opcjach, aby tylko Ty mógł je otworzyć. Starsze pliki .json nadal się wczytują."],
  } },
  { build: 62, date: "2026-11-02", items: {
    en: ["👆 Fingerprint and face unlock is more reliable, and if it fails the lock screen now says why."],
    pl: ["👆 Odblokowanie odciskiem palca i twarzą działa pewniej, a gdy się nie uda, ekran blokady podaje przyczynę."],
  } },
  { build: 61, date: "2026-11-02", items: {
    en: ["🎨 Statement analyses in soft colours: money in is green, money out is red, nothing (0,00) is grey."],
    pl: ["🎨 Analizy wyciągów w stonowanych kolorach: wpływy na zielono, wypływy na czerwono, zero (0,00) na szaro."],
  } },
  { build: 60, date: "2026-11-02", items: {
    en: ["↕️ Your own menu order (Pro): drag a page up or down in the side menu, or use Options → Menu order (also on phones). \"Standard order\" puts it back."],
    pl: ["↕️ Własna kolejność menu (Pro): przeciągnij stronę w górę lub w dół w menu bocznym albo użyj Opcje → Kolejność menu (także na telefonie). „Kolejność standardowa” przywraca ustawienie."],
  } },
  { build: 59, date: "2026-11-02", items: {
    en: ["🧩 Tidier pages: cards fill the columns evenly and the columns end level – no more empty holes, no need to drag cards around. Full-width cards come after the columns.", "📈 The savings chart is flatter, so it takes less space."],
    pl: ["🧩 Uporządkowane strony: karty równo wypełniają kolumny, a kolumny kończą się na tej samej wysokości – bez pustych dziur i bez przeciągania kart. Karty na całą szerokość są pod kolumnami.", "📈 Wykres oszczędności jest niższy i zajmuje mniej miejsca."],
  } },
  { build: 58, date: "2026-11-02", items: {
    en: ["〰️ Overview: the yellow line now shows your real savings balance at the end of each month (from your statement analyses and the amounts you entered). Without savings data it still shows what you saved (inflows minus outflows)."],
    pl: ["〰️ Przegląd: żółta linia pokazuje teraz rzeczywiste saldo oszczędności na koniec każdego miesiąca (z analiz wyciągów i wpisanych kwot). Bez danych o oszczędnościach nadal pokazuje, ile zaoszczędzono (wpływy minus wydatki)."],
  } },
  { build: 57, date: "2026-11-02", items: {
    en: ["🛠️ Reports: each diagram now belongs to its part and appears right under it – choose only Loans and you get only Loans. Table headers and legend colours now print in PDF too."],
    pl: ["🛠️ Raporty: każdy wykres należy teraz do swojej części i jest tuż pod nią – wybierz tylko Kredyty, a dostaniesz tylko Kredyty. Nagłówki tabel i kolory legendy są teraz drukowane także w PDF."],
  } },
  { build: 56, date: "2026-11-02", items: {
    en: ["🟢 Calmer menu: the page you are on is shown with a soft green tint instead of a solid green bar."],
    pl: ["🟢 Spokojniejsze menu: otwarta strona ma teraz delikatne zielone tło zamiast pełnego zielonego paska."],
  } },
  { build: 55, date: "2026-11-02", items: {
    en: ["📊 Reports now include diagrams in PDF and Word: inflows and outflows per month, outflows by category and your savings balance. Word reports are real .docx files (Word, LibreOffice, Google Docs). Reports are part of Pro.", "❓ Help, Guide and About moved into the profile menu (bottom left) – no more floating ? button over the page.", "🟢 The Import button is now a soft outline, so only the page you are on is bright green."],
    pl: ["📊 Raporty zawierają teraz wykresy w PDF i Wordzie: wpływy i wydatki miesięcznie, wydatki według kategorii i saldo oszczędności. Raporty Word to prawdziwe pliki .docx (Word, LibreOffice, Google Docs). Raporty są częścią Pro.", "❓ Pomoc, Przewodnik i Informacje są teraz w menu profilu (lewy dolny róg) – bez pływającego przycisku ? nad stroną.", "🟢 Przycisk Importuj ma teraz delikatny obrys, więc tylko otwarta strona jest jaskrawozielona."],
  } },
  { build: 54, date: "2026-11-02", items: {
    en: ["👤 One profile row at the bottom of the menu: your photo, name and Pro/Demo badge. Click it for Profile & license, Options, Language, Help and Close."],
    pl: ["👤 Jeden wiersz profilu na dole menu: Twoje zdjęcie, imię i oznaczenie Pro/Demo. Kliknij, aby otworzyć Profil i licencję, Opcje, Język, Pomoc i Zamknij."],
  } },
  { build: 53, date: "2026-11-02", items: {
    en: ["🧹 Cleaner menu: the language button is gone (change the language in Options), your photo is round and the close button matches it."],
    pl: ["🧹 Czystsze menu: przycisk języka zniknął (język zmienisz w Opcjach), Twoje zdjęcie jest okrągłe, a przycisk zamykania do niego pasuje."],
  } },
  { build: 52, date: "2026-11-02", items: {
    en: ["📑 New Reports tab: choose the period (this month, last 3 months, this year, your own dates…) and what to include, see the key figures, then export to Excel, PDF or Word. The Data button is gone – Export is in Reports, Delete data in Options."],
    pl: ["📑 Nowa zakładka Raporty: wybierz okres (ten miesiąc, ostatnie 3 miesiące, ten rok, własne daty…) i co ma się znaleźć w raporcie, zobacz najważniejsze liczby, a potem eksportuj do Excela, PDF lub Worda. Przycisk Dane zniknął – eksport jest w Raportach, usuwanie danych w Opcjach."],
  } },
  { build: 51, date: "2026-11-02", items: {
    en: ["👤 Saving and loading your profile file is now only in your profile (top right) – not in the Data menu or Options."],
    pl: ["👤 Zapis i wczytanie pliku profilu są teraz tylko w Twoim profilu (prawy górny róg) – nie w menu Dane ani w Opcjach."],
  } },
  { build: 50, date: "2026-11-02", items: {
    en: ["⬆ One Import for every bank statement: the big Import button at the top of the menu (or the button next to the page title). MoneyCompass recognises the file – a current account goes to Outflows and Inflows, a savings account to Savings – and asks only when it can't tell.", "🖱️ Drag a CSV file onto the app to import it.", "🗂 The Data menu now holds export and delete; saving and loading your profile is in your profile (top right)."],
    pl: ["⬆ Jeden Import dla każdego wyciągu: duży przycisk Importuj na górze menu (lub przycisk obok tytułu strony). MoneyCompass rozpoznaje plik – konto osobiste trafia do Wydatków i Wpływów, rachunek oszczędnościowy do Oszczędności – i pyta tylko wtedy, gdy nie jest pewien.", "🖱️ Przeciągnij plik CSV na aplikację, aby go zaimportować.", "🗂 Menu Dane zawiera teraz eksport i usuwanie; zapis i wczytanie profilu są w Twoim profilu (prawy górny róg)."],
  } },
  { build: 49, date: "2026-11-02", items: {
    en: ["🏦 Clearer savings: importing a current account never changes a savings account any more. Transfers to your own accounts are listed in Outflows (\"Moved to your own accounts\"), not counted as spending. A savings account's balance and history come only from its own statement: Savings → Import savings account statement."],
    pl: ["🏦 Przejrzyste oszczędności: import konta osobistego nie zmienia już rachunku oszczędnościowego. Przelewy na własne rachunki widać w Wydatkach („Przelewy na własne konta”), nie są liczone jako wydatki. Saldo i historia rachunku oszczędnościowego pochodzą tylko z jego wyciągu: Oszczędności → Import wyciągu z rachunku oszczędnościowego."],
  } },
  { build: 48, date: "2026-11-02", items: {
    en: ["📈 Savings chart from a current-account import: transfers to and from your savings account now give its month-by-month balance, credits and debits – even without a savings statement. If the balance would go below 0, MoneyCompass tells you how much was probably on the account before.", "🧩 Moved cards are now remembered by their title, so they no longer get mixed up when a card appears or disappears."],
    pl: ["📈 Wykres oszczędności z importu konta osobistego: przelewy na rachunek oszczędnościowy i z niego dają teraz saldo miesiąc po miesiącu, uznania i obciążenia – nawet bez wyciągu z rachunku oszczędnościowego. Jeśli saldo spadłoby poniżej 0, MoneyCompass podpowiada, ile prawdopodobnie było na rachunku wcześniej.", "🧩 Przesunięte karty są teraz zapamiętywane po tytule, więc nie mieszają się, gdy jakaś karta się pojawia lub znika."],
  } },
  { build: 47, date: "2026-11-02", items: {
    en: ["⭐ All backups are now part of MoneyCompass Pro: saving your profile as a file, the file password and the automatic backup. The free version is a demo – \"Load a profile…\" still works there."],
    pl: ["⭐ Wszystkie kopie zapasowe są teraz częścią MoneyCompass Pro: zapis profilu do pliku, hasło do plików i automatyczna kopia. Wersja darmowa to demo – „Wczytaj profil…” nadal tam działa."],
  } },
  { build: 46, date: "2026-11-02", items: {
    en: ["⭐ PIN, fingerprint/face unlock, automatic lock and the automatic backup are now part of MoneyCompass Pro. A PIN you already set keeps protecting your profile, and you can always remove it. Saving your profile as a file stays free."],
    pl: ["⭐ PIN, odblokowanie odciskiem palca/twarzą, automatyczna blokada i automatyczna kopia są teraz częścią MoneyCompass Pro. Ustawiony już PIN nadal chroni Twój profil i zawsze możesz go usunąć. Zapis profilu do pliku pozostaje darmowy."],
  } },
  { build: 45, date: "2026-11-02", items: {
    en: ["🔎 Category lists now have a search box: click (or start typing) and only matching categories are shown – choose with ↑↓ and Enter.", "🏷️ More icons: son, daughter, investments (📈 💹 🪙), banking (💳 🏧) and cash."],
    pl: ["🔎 Listy kategorii mają teraz pole wyszukiwania: kliknij (lub zacznij pisać), a pokażą się tylko pasujące kategorie – wybierz strzałkami ↑↓ i Enter.", "🏷️ Więcej ikon: syn, córka, inwestycje (📈 💹 🪙), bankowość (💳 🏧) i gotówka."],
  } },
  { build: 44, date: "2026-11-02", items: {
    en: ["👪 More category icons: family, children, toys, wedding, birthday, grandparents, home, and pets (paw, fish, bird, horse, rabbit, parrot)."],
    pl: ["👪 Więcej ikon kategorii: rodzina, dzieci, zabawki, ślub, urodziny, dziadkowie, dom oraz zwierzęta (łapa, ryba, ptak, koń, królik, papuga)."],
  } },
  { build: 43, date: "2026-11-02", items: {
    en: ["🏷️ \"New category…\" in any category list now lets you choose an icon and mark the category as essential."],
    pl: ["🏷️ „Nowa kategoria…” na każdej liście kategorii pozwala teraz wybrać ikonę i oznaczyć kategorię jako niezbędną."],
  } },
  { build: 42, date: "2026-11-02", items: {
    en: ["🔴 Negative amounts and warnings are now red (were purple), and a savings rate below −100% shows as \"< −100%\"."],
    pl: ["🔴 Kwoty ujemne i ostrzeżenia są teraz czerwone (były fioletowe), a stopa oszczędności poniżej −100% jest pokazana jako „< −100%”."],
  } },
  { build: 41, date: "2026-11-02", items: {
    en: ["🛠️ Bank import: money transferred back from a savings account is now taken off its balance (before, only what went in was counted). You can also enter the savings account's balance today right in the import.", "🛠️ Transfers called \"internal transfer\" (e.g. Millennium) to another person are no longer taken for your own account.", "💶 Money from your own accounts (e.g. your salary account in another bank) now shows in Imported inflows as \"Not income\" – switch it to Salary when that bank's statement isn't imported. After an import, only the newest salary is offered as your monthly income."],
    pl: ["🛠️ Import wyciągu: pieniądze przelane z powrotem z rachunku oszczędnościowego są teraz odejmowane od jego salda (wcześniej liczono tylko wpłaty). Możesz też od razu w imporcie wpisać dzisiejsze saldo rachunku oszczędnościowego.", "🛠️ Przelewy opisane jako „internal transfer” (np. Millennium) do innej osoby nie są już traktowane jako przelewy na własny rachunek.", "💶 Wpływy z Twoich własnych rachunków (np. rachunku z pensją w innym banku) są teraz widoczne w importowanych wpływach jako „Nie dochód” – zmień na Wynagrodzenie, jeśli nie importujesz wyciągu z tego banku. Po imporcie proponowana jest tylko najnowsza pensja jako miesięczny dochód."],
  } },
  { build: 40, date: "2026-11-02", items: {
    en: ["🛠️ Bank import: transfers to a savings account are no longer counted twice – transfers dated before the account's known balance (from a statement analysis or your last update) are already in it and are not added again.", "📈 A savings account created from a statement analysis keeps its month-end balances, so the chart shows the history even without the analysis."],
    pl: ["🛠️ Import wyciągu: przelewy na rachunek oszczędnościowy nie są już liczone podwójnie – przelewy sprzed znanego salda rachunku (z analizy wyciągu lub ostatniej aktualizacji) są już w nim zawarte i nie są dodawane ponownie.", "📈 Rachunek oszczędnościowy utworzony z analizy wyciągu zachowuje salda na koniec miesięcy, więc wykres pokazuje historię nawet bez analizy."],
  } },
  { build: 39, date: "2026-11-02", items: {
    en: ["📈 Savings chart: credits and debits now use the left scale with the balance, so the interest and fees line on the right scale is always readable – all lines can be shown together."],
    pl: ["📈 Wykres oszczędności: uznania i obciążenia są teraz na lewej skali razem z saldem, więc linia odsetek i opłat na prawej skali jest zawsze czytelna – wszystkie linie mogą być widoczne razem."],
  } },
  { build: 38, date: "2026-11-02", items: {
    en: ["ℹ️ Savings chart: point at an interest dot (or the interest total) to see gross interest, the 19% tax and net interest."],
    pl: ["ℹ️ Wykres oszczędności: najedź na punkt odsetek (lub ich sumę), aby zobaczyć odsetki brutto, 19% podatek i odsetki netto."],
  } },
  { build: 37, date: "2026-11-02", items: {
    en: ["🧮 Savings chart: interest is now shown after the 19% tax (net), exactly as in your statement analysis."],
    pl: ["🧮 Wykres oszczędności: odsetki są teraz pokazane po 19% podatku (netto), dokładnie jak w analizie wyciągu."],
  } },
  { build: 36, date: "2026-11-02", items: {
    en: ["📈 Savings chart with lines only: balance on the left scale; interest, fees, credits and debits per month on the right scale. Click a name to show or hide a line."],
    pl: ["📈 Wykres oszczędności tylko z liniami: saldo na lewej skali; odsetki, opłaty, uznania i obciążenia miesięcznie na prawej. Kliknij nazwę, aby pokazać lub ukryć linię."],
  } },
  { build: 35, date: "2026-11-02", items: {
    en: ["📈 Savings balance chart at the top of the Savings tab: closing balance per month for all your accounts, with credits, interest, debits and fees per month. From your oldest data to today – add a 1 to 6 month forecast if you like.", "🎯 Savings goals moved to the Budget plan, next to your monthly limits – a goal can now be linked to an account, so its progress updates by itself.", "🏦 Clearer banking terms: opening and closing balance, credits and debits, gross and net rate, withholding tax, fees & charges.", "🖱️ Scrollbars stay hidden until you move the mouse over a window."],
    pl: ["📈 Wykres salda oszczędności na górze zakładki Oszczędności: saldo końcowe każdego miesiąca dla wszystkich rachunków, z uznaniami, odsetkami, obciążeniami i opłatami. Od najstarszych danych do dziś – opcjonalnie z prognozą na 1–6 miesięcy.", "🎯 Cele oszczędnościowe przeniesione do Planu budżetu, obok miesięcznych limitów – cel można powiązać z rachunkiem, wtedy postęp aktualizuje się sam.", "🏦 Bardziej fachowe nazwy: saldo początkowe i końcowe, uznania i obciążenia, oprocentowanie brutto i netto, podatek od odsetek, opłaty i prowizje.", "🖱️ Paski przewijania są ukryte, dopóki nie najedziesz myszą na okno."],
  } },
  { build: 34, date: "2026-11-02", items: {
    en: ["🛡️ Automatic backup: choose a file once (for example in Documents or OneDrive) and MoneyCompass keeps an encrypted copy of your profile up to date after every change. If the browser data is ever deleted, \"Load a profile…\" brings everything back. Chrome and Edge on a computer; other browsers remind you to save your profile.", "🏦 Account checks: each saved check shows the balance on the last day, the fees per month (and a fees column per month), and can be added to Your savings with one click – so the Savings overview is filled too.", "🧩 Cards no longer get mixed up when a card appears or disappears, and they rearrange when you open a section. Windows no longer show needless scrollbars."],
    pl: ["🛡️ Automatyczna kopia: wybierz plik raz (np. w Dokumentach lub OneDrive), a MoneyCompass po każdej zmianie aktualizuje zaszyfrowaną kopię Twojego profilu. Jeśli dane przeglądarki zostaną usunięte, „Wczytaj profil…” przywróci wszystko. Chrome i Edge na komputerze; inne przeglądarki przypominają o zapisaniu profilu.", "🏦 Sprawdzenia kont: każde zapisane sprawdzenie pokazuje saldo w ostatnim dniu, opłaty miesięcznie (i kolumnę opłat dla każdego miesiąca) oraz można je jednym kliknięciem dodać do oszczędności – wtedy podsumowanie oszczędności też jest wypełnione.", "🧩 Karty nie mieszają się już, gdy jakaś karta się pojawia lub znika, i układają się na nowo po otwarciu sekcji. Okna nie pokazują już zbędnych pasków przewijania."],
  } },
  { build: 33, date: "2026-11-02", items: {
    en: ["👆 Unlock with fingerprint or face: with a PIN set, turn it on in your profile (top right). Works with Windows Hello, Android fingerprint, Touch ID and Face ID – only on that device, and the PIN still works."],
    pl: ["👆 Odblokowanie odciskiem palca lub twarzą: gdy masz PIN, włącz je w profilu (w prawym górnym rogu). Działa z Windows Hello, odciskiem palca w Androidzie, Touch ID i Face ID – tylko na tym urządzeniu, a PIN nadal działa."],
  } },
  { build: 32, date: "2026-11-02", items: {
    en: ["🧩 Tidier pages: on every tab the summary comes first, then your list, then the form to add something – and cards fill the columns evenly without big gaps.", "📐 More compact: tighter spacing on every page, so you scroll less."],
    pl: ["🧩 Uporządkowane strony: na każdej zakładce najpierw podsumowanie, potem Twoja lista, a na końcu formularz dodawania – karty równo wypełniają kolumny, bez dużych przerw.", "📐 Bardziej zwarty układ: mniejsze odstępy na każdej stronie, mniej przewijania."],
  } },
  { build: 31, date: "2026-11-02", items: {
    en: ["📑 Keep a savings account check: after checking a statement, \"Save result\" keeps it in the Savings tab under \"Your account checks\" – only if you choose to save it."],
    pl: ["📑 Zachowaj sprawdzenie konta: po sprawdzeniu wyciągu „Zapisz wynik” zachowuje go w zakładce Oszczędności w „Twoich sprawdzeniach kont” – tylko jeśli zdecydujesz się go zapisać."],
  } },
  { build: 30, date: "2026-11-02", items: {
    en: ["🔍 New in Savings: \"What does my savings account really pay?\" – import the CSV statement of a savings account and see the real rate per year and per month, worked out from the money really on the account day by day, with interest, the 19% tax and fees. One click puts the result into your savings entry."],
    pl: ["🔍 Nowość w Oszczędnościach: „Ile naprawdę płaci moje konto oszczędnościowe?” – zaimportuj wyciąg CSV z konta oszczędnościowego i zobacz rzeczywiste oprocentowanie rocznie i miesięcznie, wyliczone ze środków dzień po dniu, z odsetkami, 19% podatku i opłatami. Jednym kliknięciem wynik trafia do Twojej pozycji oszczędności."],
  } },
  { build: 29, date: "2026-11-02", items: {
    en: ["🌿 One design: Emerald. Navy and the classic designs are gone, so everything looks the same everywhere – and the profile window opens next to the side menu."],
    pl: ["🌿 Jeden wygląd: Emerald. Granatowy i klasyczne wyglądy zostały usunięte, więc wszystko wygląda wszędzie tak samo – a okno profilu otwiera się obok menu bocznego."],
  } },
  { build: 28, date: "2026-11-02", items: {
    en: ["📅 Income sources can have a first and a last payment (optional): a new job counts only from its first payday, a job that ends stops after its last one – in the calendar, the charts and all averages.", "🗓 The Payment calendar is now simply called Calendar.", "🧾 Clearer income form: Payment date, an optional Start date and an End date with \"No end date\" for income that continues.", "📥 \"Imported inflows\" are grouped by month – the newest open, older ones folded – with filters for salary, extra income and not income."],
    pl: ["📅 Źródła dochodu mogą mieć pierwszą i ostatnią wypłatę (opcjonalnie): nowa praca liczy się dopiero od pierwszej wypłaty, a kończąca się – do ostatniej. Dotyczy kalendarza, wykresów i wszystkich średnich.", "🗓 Kalendarz płatności nazywa się teraz po prostu Kalendarz.", "🧾 Czytelniejszy formularz dochodu: Data wypłaty, opcjonalna Data rozpoczęcia i Data zakończenia z opcją „Bez daty zakończenia”.", "📥 „Zaimportowane wpływy” są pogrupowane według miesięcy – najnowszy otwarty, starsze zwinięte – z filtrami: pensja, dodatkowy dochód, nie dochód."],
  } },
  { build: 27, date: "2026-11-01", items: {
    en: ["🎯 “My savings” is now called “Savings”, and your Savings goals (Pro) are shown right inside it – one tab less.", "🔎 Optimize my finances compares each loan with today's best offers: bank, rate, your new monthly payment and what you would save after switching costs – with a link to the full ranking. Offers are updated every day.", "🎨 New look: Emerald is now the standard design, with a side menu that folds away. With the Design switch at the top right you can choose Navy or the classic light or dark design instead.", "🏷 Change the category of one outflow and MoneyCompass offers to change all the same ones too – and new imports from that shop get it automatically. A new button sorts all \"Other\" outflows by shop in one go.", "📅 The monthly chart on the Overview now shows all months from your oldest entry, with the start and end date.", "🔒 New: a PIN for each profile (in your profile, top right) and an automatic lock after some minutes without use (Options). The PIN is never saved as such – only a secure hash.", "🔐 Protect your profile files with a password (Options → Backup & restore): saved files are encrypted with AES-256 and can only be opened with the password.", "〰️ New on the Overview: Trends month by month – smooth wave lines for inflows, outflows, what you saved and loan payments. Click a name to show or hide its line.", "📱 Phones and the open Z Fold: Emerald now has an app-like menu – a bar with icons at the bottom on phones, the side menu on tablets and foldables (open it with the small arrow).", "🏦 Several banks: money moved between your own accounts in different banks is recognised by the account number – not counted as income or as an expense, also for payments you imported before.", "🔧 Checked and corrected: past months show your manual salary, a planned expense later this month no longer breaks the averages, and regular payments are only matched with the same payment."],
    pl: ["🎯 „Moje oszczędności” to teraz „Oszczędności”, a Cele oszczędnościowe (Pro) są pokazane bezpośrednio w tej zakładce – o jedną zakładkę mniej.", "🔎 Optymalizuj finanse porównuje każdy kredyt z najlepszymi dzisiejszymi ofertami: bank, oprocentowanie, nowa rata i oszczędność po kosztach zmiany – z linkiem do pełnego rankingu. Oferty są aktualizowane codziennie.", "🎨 Nowy wygląd: Emerald jest teraz standardowym wyglądem, z menu bocznym, które się chowa. Przełącznikiem Wygląd w prawym górnym rogu możesz wybrać granatowy albo klasyczny jasny lub ciemny.", "🏷 Zmień kategorię jednego wydatku, a MoneyCompass zaproponuje zmianę wszystkich takich samych – nowe importy z tego sklepu dostaną ją automatycznie. Nowy przycisk porządkuje wszystkie wydatki „Inne” według sklepu za jednym razem.", "📅 Wykres miesięczny w Przeglądzie pokazuje teraz wszystkie miesiące od najstarszego wpisu, z datą początku i końca.", "🔒 Nowość: PIN dla każdego profilu (w profilu, prawy górny róg) i automatyczna blokada po kilku minutach bez używania (Opcje). Sam PIN nigdy nie jest zapisywany – tylko bezpieczny skrót (hash).", "🔐 Chroń pliki profilu hasłem (Opcje → Kopia zapasowa): zapisane pliki są szyfrowane AES-256 i można je otworzyć tylko z hasłem.", "〰️ Nowość w Przeglądzie: Trendy miesiąc po miesiącu – płynne linie wpływów, wydatków, oszczędności i rat kredytów. Kliknij nazwę, aby pokazać lub ukryć linię.", "📱 Telefony i otwarty Z Fold: Emerald ma teraz menu jak w aplikacji – pasek z ikonami na dole na telefonie, menu boczne na tabletach i składanych telefonach (otwierane małą strzałką).", "🏦 Kilka banków: przelewy między Twoimi kontami w różnych bankach są rozpoznawane po numerze konta – nie liczą się jako dochód ani wydatek, także dla wcześniej zaimportowanych płatności.", "🔧 Sprawdzone i poprawione: poprzednie miesiące pokazują pensję wpisaną ręcznie, wydatek zaplanowany na później w tym miesiącu nie psuje już średnich, a płatności cykliczne są dopasowywane tylko do tej samej płatności."],
  } },
  { build: 26, date: "2026-11-01", items: {
    en: ["🧭 Where should my savings go? My savings compares what your money earns now with today's best bank offers and shows how much more you'd keep after tax.", "🎁 Savings with a promotion: enter when it ends and the rate afterwards. MoneyCompass reminds you 2 weeks before, on the Overview and in the Payment calendar.", "✔ \"I moved it\" updates My savings for you – with the new promotion end date.", "📅 Payment calendar → Month by month starts with your imported months too (what really happened), then the planned months.", "💳 Loans & debts: enter how much you borrowed at the start – the Overview shows in green how much is already paid back.", "📈 Overview → Your savings: is it growing? Green, orange or red, with what you kept each month – and a clear red warning when there is no emergency fund.", "💳 Loans: no more \"last payment\" to type – enter what is left, the monthly payment, the interest and the next payment date. MoneyCompass works out the debt-free date, the payments left and the interest still to pay, and lowers what is left every month.", "📅 Payment calendar: past months show only regular payments – \"All transactions\" shows every payment.", "🏦 Loans paid from another bank (e.g. Pekao) still count every month on their payment day – no need to import that bank.", "🔁 Regular payments added in the Payment calendar now count everywhere – spending, Overview, Budget plan and forecasts – unless the same payment is already in your expenses.", "💳 Optimize my savings now checks your loans: which one to pay off first, whether overpaying beats saving, what your spare money above the emergency fund could save, and when refinancing makes sense.", "💰 Loans & debts → Pay extra: enter an overpayment (once, or try a monthly amount) and see the new debt-free date and the interest you save – shorter loan or lower monthly payment.", "🗂 Tidier top bar: Import bank statement, Export report and Delete data are now in one \"Data ▾\" menu. Profiles stay in your profile panel, Install app in the ? menu.", "🏷 Every category list now ends with \"＋ New category…\" – create a category right while changing an expense, importing or adding a regular payment.", "🔍 Expenses: filter your list by category, essential or not, repeating, or search by shop, amount or bank details – with the total of what is shown.", "💬 More details when you point at something: the four tiles explain how they are calculated, chart bars and rings show amounts and shares.", "🧾 New category \"Bank fees\": account, card, ATM and transfer fees from your bank import are recognised automatically, and Optimize tells you when a free account would save money.", "🏦 Loans use your bank's wording: principal amount repaid, interest repaid, remaining principal amount to be repaid. You can enter the interest repaid from your bank, and a changed interest rate is kept as a rate change.", "📊 Overview: \"Inflows and outflows\" like in your banking app – the balance, the period and a green/red bar with amounts and shares.", "🔍 Expense history: filter also by period (last 30, 90, 180 or 365 days) and by amount from – to. The monthly chart is now \"Financial analysis\" with green inflows and red outflows.", "📏 Amounts per month now use the days your data really covers: one imported week is no longer shown as a whole month. With less than 3 weeks of data, MoneyCompass says clearly that the numbers are an estimate.", "🔤 One set of words everywhere, as banks use them: Inflows, Outflows and Balance – also as tab names – in the tiles, charts, Payment calendar, reports and Help.", "⚡ \"Optimize my savings\" is now \"Optimize my finances\" – it also compares your loans with today's typical bank rates (mortgage, cash loan, car loan, credit card) and shows what refinancing could save.", "📜 Terms of use: a short summary to accept once, and the full terms on the website (no financial advice, estimates only, your responsibility)."],
    pl: ["🧭 Gdzie ulokować oszczędności? Moje oszczędności porównują, ile Twoje pieniądze zarabiają teraz, z najlepszymi dzisiejszymi ofertami banków i pokazują, ile więcej zostanie Ci po podatku.", "🎁 Oszczędności z promocją: wpisz, kiedy się kończy i jakie jest oprocentowanie potem. MoneyCompass przypomni 2 tygodnie wcześniej – w Przeglądzie i w kalendarzu płatności.", "✔ „Przeniosłem” sam aktualizuje Moje oszczędności – z nową datą końca promocji.", "📅 Kalendarz płatności → Miesiąc po miesiącu zaczyna się też od zaimportowanych miesięcy (co naprawdę się wydarzyło), potem miesiące planowane.", "💳 Kredyty i długi: wpisz, ile pożyczyłeś na początku – Przegląd pokaże na zielono, ile już spłaciłeś.", "📈 Przegląd → Twoje oszczędności: czy rosną? Zielono, pomarańczowo lub czerwono, z tym, co zostało w każdym miesiącu – i wyraźne czerwone ostrzeżenie, gdy brak poduszki finansowej.", "💳 Kredyty: koniec z wpisywaniem „ostatniej raty” – wpisz pozostałą kwotę, ratę, oprocentowanie i datę następnej raty. MoneyCompass wyliczy datę spłaty, liczbę rat i odsetki do zapłaty, a pozostałą kwotę co miesiąc zmniejsza.", "📅 Kalendarz płatności: minione miesiące pokazują tylko regularne płatności – „Wszystkie transakcje” pokazuje każdą.", "🏦 Kredyty spłacane z innego banku (np. Pekao) liczą się co miesiąc w dniu raty – nie trzeba importować tego banku.", "🔁 Regularne płatności dodane w kalendarzu płatności liczą się teraz wszędzie – w wydatkach, Przeglądzie, planie budżetu i prognozach – chyba że ta sama płatność jest już w Twoich wydatkach.", "💳 Optymalizacja oszczędności sprawdza teraz Twoje kredyty: który spłacać najpierw, czy nadpłata opłaca się bardziej niż oszczędzanie, ile zaoszczędzą nadwyżki ponad poduszkę finansową i kiedy warto refinansować.", "💰 Kredyty i długi → Nadpłata: wpisz nadpłatę (jednorazową albo sprawdź miesięczną) i zobacz nową datę spłaty oraz zaoszczędzone odsetki – krótszy kredyt albo niższa rata.", "🗂 Bardziej przejrzysty górny pasek: Import wyciągu, Eksport raportu i Usuń dane są teraz w jednym menu „Dane ▾”. Profile zostają w panelu profilu, Zainstaluj aplikację w menu ?.", "🏷 Każda lista kategorii kończy się teraz opcją „＋ Nowa kategoria…” – utwórz kategorię od razu przy zmianie wydatku, imporcie lub dodawaniu płatności cyklicznej.", "🔍 Wydatki: filtruj listę według kategorii, niezbędne lub nie, powtarzające się, albo szukaj po sklepie, kwocie lub danych z banku – z sumą tego, co widać.", "💬 Więcej szczegółów po najechaniu myszką: cztery kafelki wyjaśniają, jak są liczone, a słupki i wykresy kołowe pokazują kwoty i udziały.", "🧾 Nowa kategoria „Opłaty bankowe”: opłaty za konto, kartę, bankomat i przelewy z importu są rozpoznawane automatycznie, a Optymalizacja podpowie, kiedy darmowe konto by się opłaciło.", "🏦 Kredyty używają słownictwa banku: spłacony kapitał, spłacone odsetki, pozostały kapitał do spłaty. Możesz wpisać spłacone odsetki z banku, a zmiana oprocentowania zapisuje się jako zmiana stopy.", "📊 Przegląd: „Wpływy i wydatki” jak w bankowości – bilans, okres oraz zielono-czerwony pasek z kwotami i udziałami.", "🔍 Historia wydatków: filtruj też według okresu (ostatnie 30, 90, 180 lub 365 dni) i kwoty od – do. Wykres miesięczny to teraz „Analiza finansowa” z zielonymi wpływami i czerwonymi wydatkami.", "📏 Kwoty miesięczne uwzględniają teraz dni, które naprawdę obejmują Twoje dane: jeden zaimportowany tydzień nie jest już pokazywany jako cały miesiąc. Przy mniej niż 3 tygodniach danych MoneyCompass wyraźnie informuje, że to szacunek.", "🔤 Jedno słownictwo wszędzie, jak w bankach: Wpływy, Wydatki i Bilans – także w nazwach zakładek – w kafelkach, wykresach, kalendarzu płatności, raportach i Pomocy.", "⚡ „Optymalizuj oszczędności” to teraz „Optymalizuj finanse” – porównuje też Twoje kredyty z typowym dzisiejszym oprocentowaniem w bankach (hipoteczny, gotówkowy, samochodowy, karta kredytowa) i pokazuje, ile mogłoby dać refinansowanie.", "📜 Regulamin: krótkie podsumowanie do jednorazowej akceptacji i pełna treść na stronie (bez doradztwa finansowego, tylko szacunki, Twoja odpowiedzialność)."],
  } },
  { build: 25, date: "2026-11-01", items: {
    en: ["🔁 Repeating expenses show \"🔁 Monthly\" in their line.", "🏦 Regular deposits to My savings can say from which account they come (e.g. another bank).", "⬆ Bank import: mark a transfer to savings as \"Savings – every month\" – it becomes a regular deposit in the Payment calendar.", "📅 The Payment calendar starts with the oldest month of your data: before today it shows what really happened, from today what is planned. \"Today\" jumps to this month.", "ⓘ Imported entries have an info button with the details from your bank: your account, the other side's name and account, the title.", "🌐 Choose the language with the 🌐 button at the top and in the guide.", "🔁 Every expense shows its repeat: grey \"Does not repeat\", or blue with how often. Click it to choose daily, weekly, monthly… or your own, e.g. every 3 days. The same for money received (not salary) in the Income tab.", "❎ Closing the window with the X: if you changed something since the last profile file, the browser asks first. Your entries always stay in this browser."],
    pl: ["🔁 Powtarzające się wydatki pokazują „🔁 Co miesiąc” w swoim wierszu.", "🏦 Przy regularnych wpłatach na oszczędności możesz podać, z jakiego konta pochodzą (np. z innego banku).", "⬆ Import z banku: oznacz przelew na oszczędności jako „Oszczędności – co miesiąc” – stanie się regularną wpłatą w kalendarzu płatności.", "📅 Kalendarz płatności zaczyna się od najstarszego miesiąca Twoich danych: przed dziś pokazuje, co naprawdę się wydarzyło, od dziś – co jest zaplanowane. „Dziś” przenosi do bieżącego miesiąca.", "ⓘ Zaimportowane wpisy mają przycisk informacji ze szczegółami z banku: Twoje konto, nazwa i konto kontrahenta, tytuł.", "🌐 Wybierz język przyciskiem 🌐 na górze oraz w przewodniku.", "🔁 Każdy wydatek pokazuje powtarzanie: szare „Nie powtarza się” albo niebieskie z częstotliwością. Kliknij, aby wybrać codziennie, co tydzień, co miesiąc… albo własne, np. co 3 dni. To samo dla wpływów (nie wynagrodzenia) w zakładce Dochód.", "❎ Zamykanie okna przez X: jeśli coś zmieniłeś od ostatniego pliku profilu, przeglądarka najpierw zapyta. Twoje wpisy zawsze zostają w tej przeglądarce."],
  } },
  { build: 24, date: "2026-11-01", items: {
    en: ["🗑 Deleted items: at the bottom of each tab you see what you deleted – put it back with ↩ Restore."],
    pl: ["🗑 Usunięte pozycje: na dole każdej karty widzisz, co usunięto – przywróć to przyciskiem ↩ Przywróć."],
  } },
  { build: 23, date: "2026-11-01", items: {
    en: ["🎨 Expenses: coloured buttons – blue 🔁 repeat (bright when on), amber ✎ edit (with a light background when you changed the expense), red 🗑 delete."],
    pl: ["🎨 Wydatki: kolorowe przyciski – niebieskie 🔁 powtarzanie (jasne, gdy włączone), bursztynowa ✎ edycja (z jasnym tłem, gdy wydatek został zmieniony), czerwone 🗑 usuwanie."],
  } },
  { build: 22, date: "2026-11-01", items: {
    en: ["📊 Clearer charts: \"Your expenses\" shows from which date to which date it counts, and the current month is marked as not finished (planned income, expenses so far)."],
    pl: ["📊 Czytelniejsze wykresy: „Twoje wydatki” pokazują, od której do której daty są liczone, a bieżący miesiąc jest oznaczony jako niezakończony (dochody zaplanowane, wydatki do tej pory)."],
  } },
  { build: 20, date: "2026-11-01", items: {
    en: ["🔁 Expenses can repeat: choose \"Repeats\" when adding an expense, or click 🔁 next to it – it then appears every month in the Payment calendar.", "🏦 My savings: add a regular deposit (standing order) to a savings entry – it appears automatically as \"To savings\" in the Payment calendar."],
    pl: ["🔁 Wydatki mogą się powtarzać: wybierz „Powtarzanie” przy dodawaniu wydatku albo kliknij 🔁 obok niego – pojawi się co miesiąc w kalendarzu płatności.", "🏦 Moje oszczędności: dodaj regularną wpłatę (zlecenie stałe) – pojawi się automatycznie jako „Na oszczędności” w kalendarzu płatności."],
  } },
  { build: 19, date: "2026-11-01", items: {
    en: ["📅 New module \"Payment calendar\" (Pro): salary, bills, subscriptions and savings transfers in a calendar, with a preview of the next 1, 3, 6 or 12 months. Switch it on in Options → Modules.", "💡 It finds payments that come back every month in your expenses – add them with one click.", "⠿ Wide cards like \"Comparison\" can be moved too.", "💰 Income: enter your gross salary and MoneyCompass estimates the net (Poland, employment contract) – you can always correct it.", "⏸ Switch income and regular payments on or off, and give regular payments a last payment date.", "🔄 Compare offers shows when the bank offers were last updated.", "🏦 Mon épargne : ajoutez un versement régulier (virement permanent) – il apparaît automatiquement comme « Vers l'épargne » dans le calendrier des paiements."],
    pl: ["📅 Nowy moduł „Kalendarz płatności” (Pro): pensja, rachunki, subskrypcje i przelewy na oszczędności w kalendarzu, z podglądem na 1, 3, 6 lub 12 miesięcy. Włącz go w Opcje → Moduły.", "💡 Znajduje w wydatkach płatności powtarzające się co miesiąc – dodasz je jednym kliknięciem.", "⠿ Szerokie karty, jak „Porównanie”, też można przesuwać.", "💰 Dochody: wpisz wynagrodzenie brutto, a MoneyCompass oszacuje netto (Polska, umowa o pracę) – zawsze możesz je poprawić.", "⏸ Włączaj i wyłączaj dochody oraz stałe płatności, a stałym płatnościom ustaw datę ostatniej płatności.", "🔄 Porównaj oferty pokazuje, kiedy ostatnio zaktualizowano oferty banków."],
  } },
  { build: 18, date: "2026-11-01", items: {
    en: ["🏦 Compare offers: today's best savings accounts and deposits are calculated for your amount – with the difference to your own offer and one click to add them.", "💰 Income: enter your gross salary and MoneyCompass estimates the net pay (Poland, employment contract) – you can always correct it.", "⏸ Switch regular income and payments on or off, and give regular payments a last payment date.", "🔄 Compare offers shows when the bank offers were last updated."],
    pl: ["🏦 Porównaj oferty: dzisiejsze najlepsze konta oszczędnościowe i lokaty przeliczone dla Twojej kwoty – z różnicą względem Twojej oferty i dodawaniem jednym kliknięciem."],
  } },
  { build: 14, date: "2026-11-01", items: {
    en: ["🏦 Compare offers: fill in an offer from My savings with one click, to see what your money earns now compared with other banks."],
    pl: ["🏦 Porównaj oferty: uzupełnij ofertę z Moich oszczędności jednym kliknięciem i zobacz, ile Twoje pieniądze zarabiają teraz w porównaniu z innymi bankami."],
  } },
  { build: 12, date: "2026-11-01", items: {
    en: ["⠿ Moving cards is easier: drag a card by its title or its handle – the page scrolls by itself when you reach the edge."],
    pl: ["⠿ Łatwiejsze przesuwanie kart: przeciągnij kartę za tytuł lub uchwyt – strona sama się przewija przy krawędzi."],
  } },
  { build: 10, date: "2026-11-01", items: {
    en: ["🧭 A step-by-step guide for new users – open it any time with ? → Guide.", "📅 Bank import: choose the dates – for example only one month of a 3-month statement."],
    pl: ["🧭 Przewodnik krok po kroku dla nowych użytkowników – otworzysz go zawsze przez ? → Przewodnik.", "📅 Import z banku: wybierz daty – np. tylko jeden miesiąc z 3-miesięcznego wyciągu."],
  } },
  { build: 9, date: "2026-11-01", items: {
    en: ["⠿ Move the cards on every tab with their handle, like in the Windows app.", "❓ Drag the ? button anywhere.", "➕ When there are many tabs, the extra ones go under \"More\"."],
    pl: ["⠿ Przesuwaj karty na każdej karcie za uchwyt, jak w aplikacji na Windows.", "❓ Przeciągnij przycisk ? w dowolne miejsce.", "➕ Gdy kart jest dużo, dodatkowe trafiają do „Więcej”."],
  } },
  { build: 6, date: "2026-11-01", items: {
    en: ["👤 Your profile opens under your picture (top right).", "ℹ Version and last update in ? → About."],
    pl: ["👤 Profil otwiera się pod Twoim zdjęciem (prawy górny róg).", "ℹ Wersja i ostatnia aktualizacja w ? → O aplikacji."],
  } },
  { build: 2, date: "2026-10-31", items: {
    en: ["📲 Install MoneyCompass as an app on your phone, tablet or computer – it also opens without internet.", "💾 \"Save your profile before closing?\" with the ⏻ button."],
    pl: ["📲 Zainstaluj MoneyCompass jako aplikację na telefonie, tablecie lub komputerze – działa też bez internetu.", "💾 „Zapisać profil przed zamknięciem?” przyciskiem ⏻."],
  } },
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
  const clean = x => String(x).replace(/^\s*✨\s*/, "");
  const box = popup(`<div class="nw-hd"><span class="nw-hi">${ico("star")}</span><div><h2>${esc(T("What's new"))}</h2><p class="nw-sub">${esc(T("The latest improvements to MoneyCompass."))}</p></div><button class="nw-x" data-close aria-label="Close">✕</button></div>
    <div class="wn-list">${list.map((n, i) => `<div class="nw-card wn-item${i === 0 ? " wn-new" : ""}"><div class="wn-head"><span class="wn-b">${esc(T("Build {0}", n.build))}</span>${i === 0 ? `<span class="em-pill">${esc(T("Latest"))}</span>` : ""}<span class="wn-d">${fmtDate(n.date)}</span></div>
      <ul>${(n.items[l] || n.items.en).map(x => `<li><i>${ico("star")}</i><span>${esc(clean(x))}</span></li>`).join("")}</ul></div>`).join("")}</div>
    <div class="nw-ft wn-ft"><label class="check"><input type="checkbox" name="newsoff"${State.data.Settings.NewsHidden ? " checked" : ""}><span>${esc(T("Don't show what's new after updates"))}</span></label><button class="btn main" data-close>${esc(T("OK"))}</button></div>
    <p class="hint wn-note">${esc(T("You can switch it back on in Options → Backup & restore, and always find it in ? → About."))}</p>`,
    { width: 640, cls: "nw-win wn-win", onClose: () => {
        const off = box.el.querySelector('[name="newsoff"]').checked;
        if (off !== !!State.data.Settings.NewsHidden) { State.data.Settings.NewsHidden = off; save(); }
        markSeen(); onClose && onClose(); } });
}
