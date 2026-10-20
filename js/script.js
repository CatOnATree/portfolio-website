/* =============================================================
   KATRIANA TRINH — PORTFOLIO — SITE ROUTER
   =============================================================

   ARCHITECTURE OVERVIEW
   ----------------------------------------------------------------
   This is a single-page app with two kinds of "pages":

   1. TOP-LEVEL SECTIONS — the areas listed in the side nav
      (hud-map) and counted in the SECTOR readout. Each one has an
      entry in SECTIONS below with a background zoom target
      (which point in the city to zoom into, and how far).
      Current top-level keys: home, aboutme, projects, hobbies,
      experience, contact.

   2. DETAIL / CHILD PAGES — pages that are reached by clicking
      into a top-level section (e.g. an individual hobby project)
      but are NOT part of the persistent nav or sector count. These
      do NOT need an entry in SECTIONS. Instead, the panel's HTML
      just declares data-zoom-from="parentKey" and the router
      reuses the parent's background zoom automatically. See
      index.html for the panel-hobby-1 example.

   HOW PANELS ARE FOUND
   ----------------------------------------------------------------
   Every routable panel is any element in the DOM with a
   data-panel="some-key" attribute. The router does NOT hold a
   hardcoded list of panels — it queries the DOM for them. This
   means you can add a brand new page (top-level or nested) purely
   in HTML: give the <section> a unique data-panel value, add a
   [data-nav="that-value"] trigger somewhere (a button/link), and
   it's automatically routable. No JS edits required.

   HOW TO ADD A NEW TOP-LEVEL SECTION
   ----------------------------------------------------------------
   1. Add a SECTIONS['yourKey'] entry below with ox/oy (where in
      the city, as % of viewport) and scale (how far to zoom).
   2. Add a <section class="panel" data-panel="yourKey"> in
      index.html (copy an existing one as a starting point).
   3. Add a landmark element in the .city background (optional —
      falls back to just zooming to that empty point) and a
      matching [data-nav="yourKey"] button in .hud-map and/or the
      hub's .hub-links.

   HOW TO ADD A NEW DETAIL / CHILD PAGE (e.g. another hobby project)
   ----------------------------------------------------------------
   1. Duplicate an existing detail <section> in index.html (see
      "panel-hobby-1") and give it a new unique data-panel value,
      e.g. data-panel="hobby-3".
   2. Set data-zoom-from="hobbies" (or whichever section it lives
      under) so it reuses that section's background zoom instead
      of needing its own landmark.
   3. Add a gallery card with data-nav="hobby-3" that points to it
      (see the gallery card template comment in index.html).
      That's it — no JS changes needed.
   ============================================================= */

(function () {
  "use strict";

  // ---- top-level sections: background zoom targets -------------
  // ox / oy = position in the city to zoom toward (CSS transform-origin
  // percentages). scale = how far to zoom in. index = position in the
  // SECTOR readout / nav order (keep sequential).
  var SECTIONS = {
    home:       { ox: "50%", oy: "44%", scale: 1,   index: 0, label: "HOME" },

    // NEW — placeholder landmark, see .landmark-aboutme in the CSS/HTML
    // for where to design its look later.
    aboutme:    { ox: "35%", oy: "30%", scale: 2.2, index: 1, label: "ABOUT ME" },

    projects:   { ox: "20%", oy: "60%", scale: 2.6, index: 2, label: "ENGINEERING PROJECTS" },

    // NEW — placeholder landmark, see .landmark-hobbies.
    hobbies:    { ox: "65%", oy: "62%", scale: 2.4, index: 3, label: "HOBBIES" },

    experience: { ox: "80%", oy: "56%", scale: 2.6, index: 4, label: "EXPERIENCE & SKILLS" },
    contact:    { ox: "50%", oy: "22%", scale: 2.8, index: 5, label: "CONTACT" }
  };

  var body = document.body;
  var city = document.getElementById("city");
  var sectorValue = document.getElementById("sector-value");
  var motionToggle = document.getElementById("reduce-motion-toggle");
  var cityZoomTimer;

  // Title-cases a SECTIONS label ("ENGINEERING PROJECTS" -> "Engineering
  // Projects") for use in document.title. Leaves connector characters
  // like "&" alone.
  function toTitleCase(str) {
    return str.replace(/\w\S*/g, function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  // ---- panel auto-discovery -------------------------------------
  // Any element with data-panel="key" becomes routable, whether it's
  // a top-level section or a nested detail page. Re-run this if you
  // ever inject panels dynamically after load.
  function collectPanels() {
    var map = {};
    document.querySelectorAll("[data-panel]").forEach(function (el) {
      map[el.getAttribute("data-panel")] = el;
    });
    return map;
  }
  var panels = collectPanels();

  // ---- zoom resolution -------------------------------------------
  // Walks data-zoom-from chains so a detail page (e.g. a single hobby
  // project) can inherit its parent section's background zoom instead
  // of needing its own SECTIONS entry / landmark.
  function resolveZoomKey(key) {
    var seen = {};
    while (!SECTIONS[key]) {
      var panel = panels[key];
      var parent = panel && panel.getAttribute("data-zoom-from");
      if (!parent || seen[parent]) return "home"; // fallback / guard against loops
      seen[parent] = true;
      key = parent;
    }
    return key;
  }

  // Resolves which top-level SECTIONS entry "owns" a given panel key,
  // for nav highlighting + sector readout on nested detail pages.
  function resolveTopLevelKey(key) {
    return resolveZoomKey(key);
  }

  function sectionFromHash() {
    var hash = (window.location.hash || "").replace("#", "").replace("/", "");
    return panels[hash] ? hash : "home";
  }

  function goTo(key, updateHash) {
    if (!panels[key]) key = "home";

    var zoomKey = resolveZoomKey(key);
    var cfg = SECTIONS[zoomKey] || SECTIONS.home;

    city.style.setProperty("--zoom-ox", cfg.ox);
    city.style.setProperty("--zoom-oy", cfg.oy);
    city.style.setProperty("--zoom-scale", cfg.scale);

    // Promote the city to its own compositor layer only while it is
    // actually zooming, then let it drop back. A permanent will-change on
    // this full-viewport animated element made the panels' backdrop-filter
    // flicker (most visibly the home hub buttons) after returning from a
    // section.
    city.classList.add("is-zooming");
    clearTimeout(cityZoomTimer);
    cityZoomTimer = setTimeout(function () {
      city.classList.remove("is-zooming");
    }, 1700);

    body.setAttribute("data-active", key);
    body.setAttribute("data-active-top", zoomKey);

    Object.keys(panels).forEach(function (panelKey) {
      panels[panelKey].classList.toggle("is-active", panelKey === key);
    });

    // Embedded PDFs: iframes on a detail page carry their URL in data-pdf.
    // Load it only while that panel is the active one, and unload it on the
    // way out. A live PDF viewer is a heavy compositor layer, and leaving
    // several of them mounted behind hidden panels makes the animated
    // background and fixed HUD buttons flicker. This keeps exactly one
    // page's PDFs alive at a time.
    Object.keys(panels).forEach(function (panelKey) {
      var isActive = panelKey === key;
      panels[panelKey].querySelectorAll("iframe[data-pdf]").forEach(function (frame) {
        if (isActive && !frame.getAttribute("src")) {
          frame.setAttribute("src", frame.getAttribute("data-pdf"));
        } else if (!isActive && frame.getAttribute("src")) {
          frame.removeAttribute("src");
        }
      });
    });

    document.querySelectorAll(".map-node").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.getAttribute("data-nav") === zoomKey);
    });

    var topIndex = SECTIONS[zoomKey] ? SECTIONS[zoomKey].index : 0;
    var topCount = Object.keys(SECTIONS).length - 1;
    sectorValue.textContent =
      String(topIndex).padStart(2, "0") + " / " + String(topCount).padStart(2, "0");

    if (updateHash !== false) {
      var newHash = "#/" + key;
      if (window.location.hash !== newHash) {
        history.pushState(null, "", newHash);
      }
    }

    // Panels can set data-title="Custom Page Title" to override the
    // default "Katriana Trinh — <Label>" title.
    var activePanel = panels[key];
    var customTitle = activePanel && activePanel.getAttribute("data-title");
    document.title = customTitle
      ? "Katriana Trinh — " + customTitle
      : key === "home"
        ? "Katriana Trinh — Biomedical Engineer"
        : "Katriana Trinh — " + toTitleCase(cfg.label);
  }

  document.addEventListener("click", function (e) {
    var trigger = e.target.closest("[data-nav]");
    if (!trigger) return;
    e.preventDefault();
    goTo(trigger.getAttribute("data-nav"));
  });

  window.addEventListener("popstate", function () {
    goTo(sectionFromHash(), false);
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && body.getAttribute("data-active") !== "home") {
      goTo("home");
    }
  });

  var reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  function setMotionReduced(reduced) {
    body.classList.toggle("motion-reduced", reduced);
    motionToggle.setAttribute("aria-pressed", String(reduced));
  }
  setMotionReduced(reduceMotionQuery.matches);
  motionToggle.addEventListener("click", function () {
    setMotionReduced(!body.classList.contains("motion-reduced"));
  });

  goTo(sectionFromHash(), false);
})();
