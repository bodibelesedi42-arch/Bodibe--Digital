/* Bodibe Digital — Settings workspace */
(function (window, document) {
  "use strict";

  function el(id) { return document.getElementById(id); }

  function toast(message) {
    var old = document.querySelector(".settings-toast");
    if (old) old.remove();
    var node = document.createElement("div");
    node.className = "settings-toast";
    node.setAttribute("role", "status");
    node.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i><span></span>';
    node.querySelector("span").textContent = message;
    document.body.appendChild(node);
    window.setTimeout(function () { node.remove(); }, 2600);
  }

  function themeApi() { return window.BodibeTheme || null; }

  function themePreference() {
    var api = themeApi();
    if (api) return api.getPreference();
    try {
      var p = localStorage.getItem("bd_theme_preference");
      if (p === "light" || p === "dark" || p === "system") return p;
      var legacy = localStorage.getItem("theme");
      return legacy === "light" || legacy === "dark" ? legacy : "system";
    } catch (e) { return "system"; }
  }

  function motionPreference() {
    var api = themeApi();
    if (api) return api.getMotionPreference();
    try {
      var p = localStorage.getItem("bd_motion_preference");
      return p === "full" || p === "reduced" || p === "system" ? p : "system";
    } catch (e) { return "system"; }
  }

  function syncThemeUi() {
    var pref = themePreference();
    var effective = document.documentElement.getAttribute("data-theme") || "dark";
    document.querySelectorAll('input[name="theme"]').forEach(function (input) {
      input.checked = input.value === pref;
      var card = input.closest(".settings-choice");
      if (card) card.classList.toggle("is-selected", input.checked);
    });
    if (el("currentTheme")) {
      el("currentTheme").textContent = pref === "system" ? "System · " + effective : effective;
    }
  }

  function syncMotionUi() {
    var pref = motionPreference();
    document.querySelectorAll('input[name="motion"]').forEach(function (input) {
      input.checked = input.value === pref;
    });
  }

  function syncDevice() {
    if (!el("settingsDevice")) return;
    var mobile = window.matchMedia && window.matchMedia("(max-width: 900px)").matches;
    el("settingsDevice").textContent = mobile ? "Mobile / compact navigation" : "Desktop / full navigation";
  }

  function bindPreferences() {
    document.querySelectorAll('input[name="theme"]').forEach(function (input) {
      input.addEventListener("change", function () {
        if (!input.checked) return;
        var api = themeApi();
        if (api) api.setPreference(input.value);
        else {
          try { localStorage.setItem("bd_theme_preference", input.value); } catch (e) {}
          window.location.reload();
          return;
        }
        syncThemeUi();
        toast("Theme updated across the staff portal.");
      });
    });

    document.querySelectorAll('input[name="motion"]').forEach(function (input) {
      input.addEventListener("change", function () {
        if (!input.checked) return;
        var api = themeApi();
        if (api) api.setMotionPreference(input.value);
        else {
          try { localStorage.setItem("bd_motion_preference", input.value); } catch (e) {}
        }
        syncMotionUi();
        toast("Motion preference saved.");
      });
    });

    var reset = el("resetPreferences");
    if (reset) reset.addEventListener("click", function () {
      var api = themeApi();
      if (api) api.resetPreferences();
      else {
        try {
          localStorage.removeItem("bd_theme_preference");
          localStorage.removeItem("bd_motion_preference");
          localStorage.removeItem("theme");
        } catch (e) {}
      }
      syncThemeUi();
      syncMotionUi();
      toast("Interface preferences reset to device defaults.");
    });

    var signOut = el("settingsSignOut");
    if (signOut) signOut.addEventListener("click", function () {
      if (window.BodibePortal) window.BodibePortal.goToLogin();
      else window.location.href = "staff-login.html";
    });
  }

  function fillIdentity(staff) {
    if (!staff) return;
    if (el("settingsStaffName")) el("settingsStaffName").textContent = staff.name || "—";
    if (el("settingsStaffRole")) el("settingsStaffRole").textContent = staff.role || "—";
    if (el("settingsStaffDepartment")) el("settingsStaffDepartment").textContent = staff.department || "—";
  }

  function init() {
    syncThemeUi();
    syncMotionUi();
    syncDevice();
    bindPreferences();

    window.addEventListener("bodibe:themechange", syncThemeUi);
    window.addEventListener("resize", syncDevice);

    if (window.BodibePortal) {
      window.BodibePortal.onReady(function (ctx) { fillIdentity(ctx && ctx.staff); });
      window.BodibePortal.onFail(function () {
        if (el("settingsStaffName")) el("settingsStaffName").textContent = "Session unavailable";
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(window, document);
