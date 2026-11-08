// Redesigned About and Help & Learning Center windows.
import { T, license, currentName, lang, fmtDate } from "./core.js";
import { esc, popup } from "./ui.js";
import { App } from "./app.js";
import { WEB_VERSION, WEB_BUILD, WEB_DATE } from "./version.js";
import { NEWS, openNews } from "./news.js";
import { backupInfo } from "./backup.js";
import { hasPin } from "./lock.js";
import { ico } from "./nw.js";

const logo = `<img class="nw-logo" src="brand.svg" alt="">`;
const ok = `<span class="nw-ok">${ico("check")}</span>`;

export function openAbout({ install, installed } = {}) {
  const news = (NEWS[0]?.items?.[lang()] || NEWS[0]?.items?.en || []).slice(0, 5);
  const pro = license.isPro, name = license.current?.name || currentName();
  const links = [["doc", T("Release Notes"), "news"], ["doc", T("Terms of use"), "../terms.html#" + lang()], ["doc", T("Privacy policy"), "../privacy.html#" + lang()], ["book", T("Help Center"), "help"]];
  const p = popup(`<div class="nw-hd"><span class="nw-hi">${ico("shield")}</span><h2>${esc(T("About MoneyCompass"))}</h2><button class="nw-x" data-close aria-label="Close">✕</button></div>
  <div class="nw-hero">${logo}<div class="nw-title"><i>Money</i><b>Compass</b></div><p>${esc(T("Your personal money overview"))}</p></div>
  <div class="nw-stat">
    <div>${ico("cube", "big")}<span><small>${esc(T("Version"))}</small><b>${esc(WEB_VERSION)}</b><small>${esc(T("Build {0}", WEB_BUILD))}</small></span></div>
    <div>${ico("cloud", "big")}<span><small>${esc(T("Last update: {0}", ""))}</small><b>${esc(fmtDate(WEB_DATE))}</b><small>${esc(WEB_DATE.slice(11, 16))}</small></span></div>
    <div>${ico("check", "big ring")}<span><small>${esc(T("Application Status"))}</small><b>${esc(T("Up to date"))}</b><small>${esc(installed?.() ? T("Installed as an app on this device.") : T("Web version"))}</small></span></div>
  </div>
  <div class="nw-g2">
    <div class="nw-card"><div class="nw-ch">${ico("star", "gold")}<h3>${esc(T("What's new"))}</h3><button class="nw-pill" data-news>${ico("doc")}${esc(T("Release Notes"))}</button></div>
      <ul class="nw-ul">${news.map(x => `<li>${ok}<span>${esc(x.replace(/^✨\s*/, ""))}</span></li>`).join("")}</ul></div>
    <div class="nw-card"><div class="nw-ch">${ico("crown", "gold")}<h3>MoneyCompass ${pro ? "Pro" : ""}</h3>${pro ? `<span class="nw-tag">PRO</span>` : ""}</div>
      <div class="nw-pro">${ico("gem", "gem")}<div>${pro ? `<p class="g">${ok} ${esc(T("Pro Plan"))}</p>` : ""}<small>${esc(T("Licensed to"))}</small><b>${esc(name)}</b><small>${esc(T("Status"))}</small><b class="g">${esc(pro ? T("Active") : T("Free version"))}</b></div></div></div>
  </div>
  <div class="nw-g2 b">
    <div class="nw-card"><div class="nw-ch">${ico("headset")}<h3>${esc(T("Support & Resources"))}</h3></div>
      ${links.map(l => `<a class="nw-link" ${l[2] === "news" || l[2] === "help" ? `href="#" data-go="${l[2]}"` : `href="${l[2]}" target="_blank" rel="noopener"`}>${ico(l[0])}<span>${esc(l[1])}</span>${ico("chev", "ch")}</a>`).join("")}</div>
    <div class="nw-card"><div class="nw-ch">${ico("bars")}<h3>${esc(T("Account Health"))}</h3></div>
      <div class="nw-ah"><div>
        <p><span>${esc(T("Subscription"))}</span>${ok}<em>${esc(pro ? T("Active") : T("Free version"))}</em></p>
        <p><span>${esc(T("Security"))}</span>${ok}<em>${esc(hasPin() ? T("Protected") : T("No PIN"))}</em></p>
        <p><span>${esc(T("Backup"))}</span>${ok}<em>${esc(backupInfo().status === "on" ? T("Enabled") : T("Off"))}</em></p></div>
        <div class="nw-ov">${ico("check", "ring big")}<b>${esc(T("Excellent"))}</b></div></div></div>
  </div>
  <div class="nw-foot">${ico("shield", "big")}<div><b>MoneyCompass</b><small>${esc(T("© {0} MoneyCompass. All rights reserved.", new Date().getFullYear()))}</small></div>
    ${!installed?.() && install ? `<button class="btn second" data-install>${esc(T("Install app"))}</button>` : ""}<button class="btn main" data-close>${esc(T("Close"))}</button></div>`, { width: 900, cls: "nw-win" });
  p.el.querySelectorAll("[data-news]").forEach(b => b.onclick = e => { e.preventDefault(); p.close(); openNews(true); });
  p.el.querySelectorAll("[data-go]").forEach(b => b.onclick = async e => { e.preventDefault(); p.close(); if (b.dataset.go === "news") openNews(true); else (await import("./dialogs.js")).openHelp(); });
  const ib = p.el.querySelector("[data-install]"); if (ib) ib.onclick = () => { p.close(); install(); };
}

export function openHelpCenter() {
  const go = r => `data-r="${r}"`;
  const top = [["rocket", "Getting Started", "Set up your account and start managing your finances.", "income"], ["play", "Video Guides", "Watch step-by-step tutorials.", ""], ["q", "Frequently Asked Questions", "Find quick answers.", "#faq"], ["headset", "Contact Support", "Get help from our team.", ""]];
  const steps = [["wallet", "Add Income", "Import bank statements or add salary manually.", "Open Income", "income"], ["list", "Track Expenses", "Import transactions and categorize spending automatically.", "Open Expenses", "expenses"], ["shield", "Build Emergency Fund", "Calculate your recommended financial safety net.", "Open Emergency Fund", "emergency"], ["trend", "Grow Savings", "Track wealth and maximize returns.", "Open Savings", "portfolio"]];
  const disc = [["bars", "Overview", "Get a complete view of your finances.", "overview"], ["pie", "Budget Plan", "Plan your budget with smart tools.", "budget"], ["coins", "Loans & Debts", "Manage your loans and debts.", "loans"], ["cal", "Calendar", "Keep track of upcoming financial events.", "calendar"], ["scale", "Compare Offers", "Find the best savings and loan offers.", "savings"], ["doc", "Reports", "Analyze your finances with detailed reports.", "reports"]];
  const tips = ["Optimize My Finances creates a personal financial action plan.", "Compare Offers shows actual returns after tax.", "Reports generate Excel, PDF and Word summaries.", "Automatic backups are encrypted and protected.", "Import bank statements to save time."];
  const faq = [["How do I import a statement?", "Press Import at the top (or drop the CSV file on the page): MoneyCompass recognises the bank and sorts the payments into categories."], ["How does Emergency Fund work?", "It shows how much to keep aside for bad times: 3–6 months of essential costs."], ["What is Belka Tax?", "The 19% Polish tax on interest from savings. MoneyCompass subtracts it, so you see what you really get."], ["How does Compare Offers calculate profit?", "From the promo rate, its limit and length, then the rate afterwards, minus the 19% Belka tax."], ["How do backups work?", "With Pro, MoneyCompass keeps an automatic encrypted backup file where you choose (Settings)."]];
  const inc = ["Financial Optimization", "Compare Offers", "Smart Import", "Advanced Reports", "Priority Updates", "Automatic Backup"];
  const res = [["User Guide", "help"], ["Release Notes", "news"], ["Privacy Policy", "../privacy.html#" + lang()], ["Terms of use", "../terms.html#" + lang()]];
  const open = k => `<button class="nw-open" ${go(k)}>${esc(T("Open"))} ${ico("arrow")}</button>`;
  const p = popup(`<div class="nw-hd"><span class="nw-hi">${ico("book")}</span><div><h2>${esc(T("Help & Learning Center"))}</h2><p class="nw-sub">${esc(T("Learn how to get the most from MoneyCompass and improve your financial decisions."))}</p></div><button class="nw-x" data-close aria-label="Close">✕</button></div>
  <div class="nw-g4">${top.map(t => `<div class="nw-card nw-tc">${ico(t[0], "big")}<div><b>${esc(T(t[1]))}</b><small>${esc(T(t[2]))}</small>${t[3] ? open(t[3]) : ""}</div></div>`).join("")}</div>
  <div class="nw-card nw-qs"><div class="nw-ch">${ico("bolt", "gold")}<h3>${esc(T("Quick Start Guide"))}</h3></div><div class="nw-steps">${steps.map((s, i) => `<div>${ico(s[0], "big")}<span><small>${esc(T("Step {0}", i + 1))}</small><b>${esc(T(s[1]))}</b><em>${esc(T(s[2]))}</em><button class="nw-open fill" ${go(s[4])}>${esc(T(s[3]))} ${ico("arrow")}</button></span></div>`).join("")}</div></div>
  <div class="nw-g3">
    <div class="nw-card"><div class="nw-ch"><h3>${esc(T("Discover MoneyCompass"))}</h3></div><div class="nw-disc">${disc.map(d => `<div>${ico(d[0], "big")}<span><b>${esc(T(d[1]))}</b><small>${esc(T(d[2]))}</small>${open(d[3])}</span></div>`).join("")}</div></div>
    <div class="nw-card"><div class="nw-ch">${ico("bulb", "gold")}<h3>${esc(T("AI Tips & Best Practices"))}</h3></div><ul class="nw-ul">${tips.map(x => `<li>${ok}<span>${esc(T(x))}</span></li>`).join("")}</ul></div>
    <div class="nw-card nw-prom"><div class="nw-ch">${ico("crown", "gold")}<h3>MoneyCompass Pro</h3></div><small>${esc(T("Unlock the full potential of your financial planning."))}</small><b class="inc">${esc(T("Included with Pro:"))}</b><ul class="nw-ul s">${inc.map(x => `<li>${ok}<span>${esc(T(x))}</span></li>`).join("")}</ul></div>
  </div>
  <div class="nw-g2 f"><div class="nw-card" id="nw-faq"><div class="nw-ch">${ico("q", "gold")}<h3>${esc(T("Frequently Asked Questions"))}</h3></div>${faq.map(f => `<details><summary>${esc(T(f[0]))}${ico("chevd", "ch")}</summary><p>${esc(T(f[1]))}</p></details>`).join("")}</div>
    <div class="nw-card"><div class="nw-ch">${ico("book")}<h3>${esc(T("Resources"))}</h3></div>${res.map(r => `<a class="nw-link" href="#" data-res="${esc(r[1])}">${ico("doc")}<span>${esc(T(r[0]))}</span>${ico("chev", "ch")}</a>`).join("")}</div></div>
  <div class="nw-foot"><div><small>${esc(T("Numbers can be typed with a dot or a comma: 1234.50 or 1234,50."))}</small></div><button class="btn main" data-close>${esc(T("Close"))}</button></div>`, { width: 1240, cls: "nw-win nw-help" });
  p.el.querySelectorAll("[data-r]").forEach(b => b.onclick = async () => {
    const r = b.dataset.r;
    if (r === "#faq") { p.el.querySelector("#nw-faq").scrollIntoView({ behavior: "smooth" }); return; }
    p.close(); App.go(r);
  });
  p.el.querySelectorAll("[data-res]").forEach(a => a.onclick = async e => { e.preventDefault(); const r = a.dataset.res; if (r === "news") { p.close(); openNews(true); } else if (r === "help") { p.close(); (await import("./dialogs.js")).openHelp(true); } else window.open(r, "_blank", "noopener"); });
}
