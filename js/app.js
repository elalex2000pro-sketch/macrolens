/* =========================================================
   Arranque y navegación principal de MacroLens
   ========================================================= */
(function () {
  "use strict";

  const ML = (window.ML = window.ML || {});
  const utils = ML.utils;

  const ROUTES = {
    escaner: "scanner",
    scanner: "scanner",
    dia: "dashboard",
    dashboard: "dashboard",
  };

  let currentView = "scanner";

  const TITLES = {
    scanner: "MacroLens · Escáner de comidas",
    dashboard: "MacroLens · Mi día nutricional",
  };

  function viewFromHash() {
    const hash = window.location.hash.replace("#", "").toLowerCase();
    return ROUTES[hash] || "scanner";
  }

  function updateHash(tab) {
    const hash = tab === "dashboard" ? "#dia" : "#escaner";
    if (window.location.hash === hash) return;
    try {
      window.history.replaceState(null, "", hash);
    } catch {
      /* file:// en algunos navegadores limita history; no es crítico */
    }
  }

  function syncNav(tab) {
    utils.$$("[data-nav]").forEach((button) => {
      const active = button.dataset.nav === tab;
      button.classList.toggle("is-active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
  }

  function showView(tab) {
    utils.$$("[data-view]").forEach((view) => {
      const active = view.dataset.view === tab;
      view.hidden = !active;
      view.classList.toggle("is-active", active);
    });
  }

  /**
   * Cambia de pestaña.
   * @param {"scanner"|"dashboard"} tab
   * @param {{ dateKey?: string, updateHash?: boolean, focus?: boolean, scroll?: boolean }} [options]
   */
  function go(tab, options = {}) {
    const target = tab === "dashboard" ? "dashboard" : "scanner";
    const {
      dateKey = "",
      updateHash: shouldUpdateHash = true,
      focus = true,
      scroll = true,
    } = options;

    currentView = target;
    showView(target);
    syncNav(target);
    // Los avisos de la vista anterior no deben tapar la nueva pantalla.
    ML.toast?.dismissAll?.();
    if (shouldUpdateHash) updateHash(target);
    document.title = TITLES[target];

    if (target === "dashboard") {
      const key = dateKey || ML.dashboard.getSelectedDate?.() || utils.toDateKey();
      ML.dashboard.setDate(key, { announce: false });
    }

    if (scroll) {
      window.scrollTo({ top: 0, behavior: "auto" });
    }

    if (focus) {
      const heading = document.querySelector(`[data-view="${target}"] h1`);
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        window.setTimeout(() => heading.focus({ preventScroll: true }), 60);
      }
    }
  }

  function openSettings() {
    const dateKey = ML.dashboard?.getSelectedDate?.() || utils.toDateKey();
    ML.settings.open({ dateKey });
  }

  function bindNavigation() {
    utils.$$("[data-nav]").forEach((button) => {
      button.addEventListener("click", () => go(button.dataset.nav));
    });

    utils.$$("[data-open-settings]").forEach((button) => {
      button.addEventListener("click", openSettings);
    });

    document.querySelector("[data-go-home]")?.addEventListener("click", (event) => {
      event.preventDefault();
      go("scanner");
    });

    window.addEventListener("hashchange", () => {
      const target = viewFromHash();
      if (target !== currentView) go(target, { updateHash: false });
    });
  }

  function boot() {
    try {
      ML.scanner.init();
      ML.dashboard.init();
      bindNavigation();

      const initial = viewFromHash();
      go(initial, { updateHash: false, focus: false, scroll: false });

      console.info("%cMacroLens listo", "color:#3ee6a4;font-weight:600", "— datos locales, análisis simulado.");
    } catch (error) {
      console.error("[MacroLens] Error al arrancar", error);
      ML.toast?.show?.({
        message: "Algo ha fallado al cargar la app. Recarga la página para intentarlo de nuevo.",
        tone: "error",
        duration: 9000,
      });
    }
  }

  ML.app = { go, openSettings, boot };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
