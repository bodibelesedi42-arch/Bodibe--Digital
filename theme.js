/* Bodibe Digital — shared light/dark theme controller */
(function (window, document) {
  "use strict";

  var THEME_KEY = "theme";                 // effective theme used by legacy inline boot scripts
  var PREF_KEY = "bd_theme_preference";    // light | dark | system
  var MOTION_KEY = "bd_motion_preference"; // full | reduced | system
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

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function systemReducedMotion() {
    return Boolean(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function getPreference() {
    var pref = safeGet(PREF_KEY);
    if (pref === "light" || pref === "dark" || pref === "system") return pref;

    // Preserve the portal's existing saved theme as an explicit preference.
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
    // Portal pages all load theme.js. Loading this stylesheet here makes the
    // final colour pass come after each module's own CSS without editing every page.
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

      // Older portal pages use a single Font Awesome icon instead of the
      // two SVG icons used by newer pages. Keep both variants working.
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

  // Apply before wiring controls. Newer pages may already have set data-theme
  // in an inline pre-paint script; this simply makes the preference model consistent.
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindToggles);
  else bindToggles();

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
    sync: function () { applyTheme(getPreference(), { persistPreference: false }); applyMotion(getMotionPreference(), { persistPreference: false }); },
  };
})(window, document);
