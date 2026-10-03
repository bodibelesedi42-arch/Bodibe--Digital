/* Bodibe Digital — shared light/dark theme controller */
(function (window, document) {
  "use strict";

  var THEME_KEY = "theme";                 // effective theme used by legacy inline boot scripts
  var PREF_KEY = "bd_theme_preference";    // light | dark | system
  var MOTION_KEY = "bd_motion_preference"; // full | reduced | system
  var NAV_CACHE_KEY = "bd_staff_sidebar_cache_v1";
  var BRIDGE_ID = "bodibe-staff-theme";

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage can be blocked */ }
  }
  function safeRemove(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
  function sessionGet(key) {
    try { return sessionStorage.getItem(key); } catch (e) { return null; }
  }
  function sessionSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }
  function sessionRemove(key) {
    try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
  }

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function systemReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function getPreference() {
    var pref = safeGet(PREF_KEY);
    if (pref === "light" || pref === "dark" || pref === "system") return pref;
    var legacy = safeGet(THEME_KEY);
    if (legacy === "light" || legacy === "dark") return legacy;
    return "system";
  }

  function getMotionPreference() {
    var pref = safeGet(MOTION_KEY);
    return pref === "full" || pref === "reduced" || pref === "system" ? pref : "system";
  }

  function effectiveTheme(pref) {
    return pref === "system" ? systemTheme() : pref;
  }

  function effectiveMotion(pref) {
    if (pref === "reduced") return true;
    if (pref === "full") return false;
    return systemReducedMotion();
  }

  function ensureStaffThemeBridge() {
    if (document.getElementById(BRIDGE_ID)) return;
    var link = document.createElement("link");
    link.id = BRIDGE_ID;
    link.rel = "stylesheet";
    link.href = "staff-theme.css";
    document.head.appendChild(link);
  }

  function syncToggleButtons() {
    var current = document.documentElement.getAttribute("data-theme") || "dark";
    document.querySelectorAll(".theme-toggle").forEach(function (button) {
      var next = current === "dark" ? "light" : "dark";
      button.setAttribute("aria-label", "Switch to " + next + " mode");
      button.setAttribute("title", "Switch to " + next + " mode");
      button.setAttribute("aria-pressed", current === "light" ? "true" : "false");
      var icon = button.querySelector("i");
      if (icon && !button.querySelector("svg")) {
        icon.className = current === "dark" ? "fa-regular fa-sun" : "fa-regular fa-moon";
      }
    });
  }

  function syncChartDefaults() {
    if (!window.Chart || !window.Chart.defaults) return;
    var dark = document.documentElement.getAttribute("data-theme") === "dark";
    window.Chart.defaults.color = dark ? "#94a3b8" : "#64748b";
    window.Chart.defaults.borderColor = dark ? "rgba(148,163,184,.14)" : "rgba(15,23,42,.09)";
    try {
      var instances = window.Chart.instances;
      if (instances && typeof instances.forEach === "function") {
        instances.forEach(function (chart) { chart.update("none"); });
      } else if (instances && typeof instances === "object") {
        Object.keys(instances).forEach(function (key) {
          if (instances[key] && instances[key].update) instances[key].update("none");
        });
      }
    } catch (e) { /* charts are optional */ }
  }

  function applyTheme(pref, options) {
    var preference = pref === "light" || pref === "dark" || pref === "system" ? pref : getPreference();
    var effective = effectiveTheme(preference);
    document.documentElement.setAttribute("data-theme", effective);
    document.documentElement.setAttribute("data-theme-preference", preference);
    safeSet(THEME_KEY, effective);
    if (!options || options.persistPreference !== false) safeSet(PREF_KEY, preference);
    syncToggleButtons();
    syncChartDefaults();
    window.dispatchEvent(new CustomEvent("bodibe:themechange", { detail: { preference: preference, theme: effective } }));
    return effective;
  }

  function applyMotion(pref, options) {
    var preference = pref === "full" || pref === "reduced" || pref === "system" ? pref : getMotionPreference();
    var reduced = effectiveMotion(preference);
    document.documentElement.setAttribute("data-motion-preference", preference);
    document.documentElement.setAttribute("data-reduced-motion", reduced ? "true" : "false");
    if (!options || options.persistPreference !== false) safeSet(MOTION_KEY, preference);
    window.dispatchEvent(new CustomEvent("bodibe:motionchange", { detail: { preference: preference, reduced: reduced } }));
    return reduced;
  }

  function resetPreferences() {
    safeRemove(PREF_KEY);
    safeRemove(MOTION_KEY);
    safeRemove(THEME_KEY);
    applyTheme("system");
    applyMotion("system");
  }

  /* -----------------------------------------------------------------------
     FAST SIDEBAR HYDRATION

     Role navigation is still rebuilt from the server by staff-portal-shell.js.
     This cache is presentation-only: it keeps the last confirmed menu visible
     while /auth/me and /staff/my-permissions are loading on the next page.
     Backend permissions remain the security boundary and replace this cached
     markup as soon as the live response arrives.
     ----------------------------------------------------------------------- */
  function pageName(value) {
    try {
      var url = new URL(value || window.location.href, window.location.href);
      return url.pathname.split("/").pop() || "staff-dashboard.html";
    } catch (e) { return ""; }
  }

  function markCachedCurrent(list) {
    if (!list) return;
    var here = pageName(window.location.href);
    list.querySelectorAll(".portal-nav-link").forEach(function (link) {
      var current = pageName(link.href) === here;
      link.classList.toggle("is-current", current);
      if (current) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function restoreSidebarCache() {
    if (!document.body || !document.body.classList.contains("portal-shell-body")) return;
    var raw = sessionGet(NAV_CACHE_KEY);
    if (!raw) return;
    var cached;
    try { cached = JSON.parse(raw); } catch (e) { return; }
    if (!cached || !cached.html) return;

    var list = document.getElementById("navModules");
    var section = document.getElementById("navModulesSection");
    var heading = document.getElementById("navModulesHeading");
    var note = document.getElementById("navModulesNote");
    if (list && !list.innerHTML.trim()) {
      list.innerHTML = cached.html;
      markCachedCurrent(list);
      if (section) section.hidden = false;
      if (heading && typeof cached.headingHidden === "boolean") heading.hidden = cached.headingHidden;
      if (note && typeof cached.note === "string") note.textContent = cached.note;
    }

    var whoName = document.getElementById("whoName");
    var whoRole = document.getElementById("whoRole");
    var whoAvatar = document.getElementById("whoAvatar");
    if (whoName && cached.name) whoName.textContent = cached.name;
    if (whoRole && cached.role) whoRole.textContent = cached.role;
    if (whoAvatar && cached.avatar) whoAvatar.textContent = cached.avatar;
  }

  function saveSidebarCache() {
    var list = document.getElementById("navModules");
    var section = document.getElementById("navModulesSection");
    if (!list || !section || section.hidden || !list.innerHTML.trim()) return;
    var heading = document.getElementById("navModulesHeading");
    var note = document.getElementById("navModulesNote");
    var whoName = document.getElementById("whoName");
    var whoRole = document.getElementById("whoRole");
    var whoAvatar = document.getElementById("whoAvatar");
    sessionSet(NAV_CACHE_KEY, JSON.stringify({
      html: list.innerHTML,
      headingHidden: heading ? heading.hidden : false,
      note: note ? note.textContent : "",
      name: whoName ? whoName.textContent : "",
      role: whoRole ? whoRole.textContent : "",
      avatar: whoAvatar ? whoAvatar.textContent : ""
    }));
  }

  function watchSidebar() {
    var list = document.getElementById("navModules");
    var section = document.getElementById("navModulesSection");
    if (!list || !section || !window.MutationObserver) return;
    var timer = null;
    var observer = new MutationObserver(function () {
      clearTimeout(timer);
      timer = setTimeout(saveSidebarCache, 40);
    });
    observer.observe(list, { childList: true, subtree: true, attributes: true });
    observer.observe(section, { attributes: true, attributeFilter: ["hidden"] });

    document.addEventListener("click", function (event) {
      var logout = event.target.closest && event.target.closest('#logoutBtn,#logoutBtnTop,[data-portal-action="logout"]');
      if (logout) sessionRemove(NAV_CACHE_KEY);
    });
  }

  ensureStaffThemeBridge();
  applyTheme(getPreference(), { persistPreference: false });
  applyMotion(getMotionPreference(), { persistPreference: false });

  function bindToggles() {
    document.querySelectorAll(".theme-toggle").forEach(function (button) {
      if (button.dataset.themeBound === "true") return;
      button.dataset.themeBound = "true";
      button.addEventListener("click", function () {
        var current = document.documentElement.getAttribute("data-theme") || "dark";
        applyTheme(current === "dark" ? "light" : "dark");
      });
    });
    syncToggleButtons();
  }

  function bootUiHelpers() {
    restoreSidebarCache();
    watchSidebar();
    bindToggles();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootUiHelpers);
  else bootUiHelpers();

  if (window.matchMedia) {
    var themeMedia = window.matchMedia("(prefers-color-scheme: light)");
    var motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    var onThemeSystemChange = function () {
      if (getPreference() === "system") applyTheme("system", { persistPreference: false });
    };
    var onMotionSystemChange = function () {
      if (getMotionPreference() === "system") applyMotion("system", { persistPreference: false });
    };
    if (themeMedia.addEventListener) themeMedia.addEventListener("change", onThemeSystemChange);
    else if (themeMedia.addListener) themeMedia.addListener(onThemeSystemChange);
    if (motionMedia.addEventListener) motionMedia.addEventListener("change", onMotionSystemChange);
    else if (motionMedia.addListener) motionMedia.addListener(onMotionSystemChange);
  }

  window.BodibeTheme = {
    getPreference: getPreference,
    getTheme: function () { return document.documentElement.getAttribute("data-theme") || effectiveTheme(getPreference()); },
    setPreference: applyTheme,
    getMotionPreference: getMotionPreference,
    setMotionPreference: applyMotion,
    resetPreferences: resetPreferences,
    sync: function () { applyTheme(getPreference(), { persistPreference: false }); applyMotion(getMotionPreference(), { persistPreference: false }); }
  };
})(window, document);
