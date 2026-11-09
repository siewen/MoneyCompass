// Builds the layout of the legal pages: hero, numbered section cards, sticky contents list, footer.
(function () {
  var isPriv = /privacy/.test(location.pathname);
  var L = {
    en: { tag: isPriv ? "Privacy" : "Legal", other: isPriv ? "Terms of use" : "Privacy policy", priv: "Privacy policy", terms: "Terms of use", home: "Back to MoneyCompass", toc: "On this page", top: "Back to top" },
    pl: { tag: isPriv ? "Prywatność" : "Prawne", other: isPriv ? "Regulamin" : "Polityka prywatności", priv: "Polityka prywatności", terms: "Regulamin", home: "Wróć do MoneyCompass", toc: "Na tej stronie", top: "Do góry" },
  };
  var otherFile = isPriv ? "terms.html" : "privacy.html";
  function build() {
    var lang = document.documentElement.lang || "en"; var t = L[lang] || L.en;
    var art = document.querySelector("article:not([hidden])"); if (!art) return;
    document.body.classList.add("lg");
    var old = document.querySelector("header"); if (old && !old.classList.contains("lg-top")) old.remove();
    var hdr = document.querySelector("header.lg-top");
    if (!hdr) { hdr = document.createElement("header"); hdr.className = "lg-top"; document.body.prepend(hdr); }
    hdr.innerHTML = '<div class="wrap top"><a class="brand" href="index.html"><img src="logo.svg?v=2" alt=""> <span>Money<b>Compass</b></span></a>' +
      '<div class="lg-links"><a href="index.html">← ' + t.home + '</a><a href="' + otherFile + "#" + lang + '">' + t.other + '</a>' +
      '<nav class="langs">' + ["pl", "en"].map(function (l) { return '<a href="#' + l + '"' + (l === lang ? ' class="on"' : "") + ">" + l.toUpperCase() + "</a>"; }).join("") + "</nav></div></div>";
    if (!art.dataset.built) {
      art.dataset.built = "1";
      var h1 = art.querySelector("h1"), date = art.querySelector(".date");
      var hero = document.createElement("div"); hero.className = "lg-hero";
      hero.innerHTML = '<span class="tag">🛡️ ' + t.tag + "</span>"; hero.appendChild(h1); if (date) hero.appendChild(date);
      var secs = [], cur = null;
      Array.from(art.children).forEach(function (n) {
        if (n.tagName === "H2") { cur = document.createElement("section"); cur.className = "lg-sec"; cur.appendChild(n); secs.push(cur); }
        else if (cur && n !== hero) cur.appendChild(n);
      });
      art.innerHTML = ""; art.appendChild(hero);
      var layout = document.createElement("div"); layout.className = "lg-layout";
      var toc = document.createElement("nav"); toc.className = "lg-toc"; toc.innerHTML = "<h4>" + t.toc + "</h4>";
      var body = document.createElement("div"); body.className = "lg-body";
      secs.forEach(function (s, i) {
        var h = s.querySelector("h2"), id = lang + "-s" + i, txt = h.textContent.replace(/^\d+\.\s*/, "");
        s.id = id; if (i === 0) s.classList.add("sum");
        else h.innerHTML = '<span class="n">' + (i < secs.length - 1 || !/contact|kontakt/i.test(txt) ? i : "✉") + "</span><span>" + txt + "</span>";
        var a = document.createElement("a"); a.href = "#" + id; a.textContent = txt; a.onclick = function (e) { e.preventDefault(); s.scrollIntoView({ behavior: "smooth" }); history.replaceState(null, "", "#" + lang); }; toc.appendChild(a);
        body.appendChild(s);
      });
      layout.appendChild(toc); layout.appendChild(body); art.appendChild(layout);
    }
    var tocA = art.querySelectorAll(".lg-toc a"), sections = art.querySelectorAll(".lg-sec");
    function spy() { var y = window.scrollY + 120, k = 0; sections.forEach(function (s, i) { if (s.offsetTop <= y) k = i; }); tocA.forEach(function (a, i) { a.classList.toggle("on", i === k); }); }
    window.onscroll = spy; spy();
    var f = document.querySelector("footer.lg-foot");
    if (!f) { f = document.createElement("footer"); f.className = "wrap lg-foot"; f.classList.add("lg-foot"); document.body.appendChild(f); }
    f.innerHTML = '<span>© MoneyCompass</span><a href="privacy.html#' + lang + '">' + L[lang].other.replace(L[lang].other, isPriv ? L[lang].tag : L[lang].other) + '</a><a href="index.html">' + t.home + '</a><a class="sp" href="#" onclick="window.scrollTo({top:0,behavior:\'smooth\'});return false">↑ ' + t.top + "</a>";
  }
  window.addEventListener("hashchange", function () { setTimeout(build, 0); });
  build();
})();
