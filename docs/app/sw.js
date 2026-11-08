// MoneyCompass offline support: the newest version when online, the saved copy when offline.
// Your own data is never here – it stays in the browser's storage.
const CACHE = "moneycompass-v222";
const FILES = ["./", "index.html", "app.css", "manifest.webmanifest", "js/main.js", "js/version.js", "js/core.js", "js/app.js", "js/ui.js", "js/charts.js",
  "js/csv.js", "js/rates.js", "js/pages-main.js", "js/pages-pro.js", "js/dialogs.js", "js/guide.js", "js/news.js", "js/calendar.js", "js/lang-table.js", "js/lang-extra.js",
  "js/advice.js", "js/debts.js", "js/lock.js", "js/crypt.js", "js/savings-check.js", "js/backup.js", "js/import.js", "js/reports.js", "js/investments.js", "js/invest-import.js",
  "icons/icon-192.png", "icons/apple-touch-icon.png", "../logo.svg", "brand.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;   // NBP, Excel library: straight to the internet
  e.respondWith(
    // Always ask GitHub for the newest file (no old copies), the saved copy only when offline
    fetch(e.request.url, { cache: "no-cache" }).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: url.pathname.endsWith("rates.json") }).then(r => r || caches.match("index.html")))
  );
});
