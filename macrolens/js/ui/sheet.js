/* =========================================================
   Hoja inferior (bottom sheet) reutilizable y accesible
   ========================================================= */
(function () {
  "use strict";

  const ML = (window.ML = window.ML || {});
  const utils = ML.utils;
  const root = document.getElementById("sheet-root");
  const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let session = null;

  function focusableElements(panel) {
    return utils.$$(FOCUSABLE, panel).filter((element) => !element.hasAttribute("hidden") && element.offsetParent !== null);
  }

  function finishClose(instance) {
    if (instance.finished) return;
    instance.finished = true;

    document.removeEventListener("keydown", instance.onKeydown);
    root.classList.remove("is-open", "is-closing");
    root.innerHTML = "";
    root.removeAttribute("style");
    document.body.classList.remove("has-sheet");
    if (session === instance) session = null;

    if (instance.previousFocus && document.contains(instance.previousFocus)) {
      instance.previousFocus.focus({ preventScroll: true });
    }
    instance.onClose?.();
  }

  function close() {
    if (!session) return;
    const instance = session;
    if (instance.closing) return;
    instance.closing = true;

    root.classList.remove("is-open");
    root.classList.add("is-closing");
    root.style.pointerEvents = "none";

    const duration = utils.prefersReducedMotion() ? 0 : 320;
    window.setTimeout(() => finishClose(instance), duration);
  }

  /**
   * Abre una hoja.
   * @param {{ eyebrow?: string, title: string, subtitle?: string,
   *           body?: string|HTMLElement, onMount?: Function, onClose?: Function }} options
   */
  function open(options = {}) {
    if (session) return session;

    // Evita que un aviso quede flotando por encima de la hoja.
    ML.toast?.dismissAll?.();

    const {
      eyebrow = "Ajustes",
      title = "Configuración",
      subtitle = "",
      body = "",
      onMount = null,
      onClose = null,
    } = options;

    const previousFocus = document.activeElement;
    const instance = {
      closing: false,
      finished: false,
      previousFocus,
      onClose,
      onKeydown: null,
    };

    root.className = "sheet-root";
    root.innerHTML = `
      <div class="sheet-backdrop" data-sheet-close></div>
      <section class="sheet-panel" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1">
        <div class="sheet-grabber" aria-hidden="true"></div>
        <header class="sheet-header">
          <div class="sheet-header-text">
            <span class="sheet-eyebrow"></span>
            <h2 id="sheet-title"></h2>
            <p class="sheet-subtitle"></p>
          </div>
          <button class="icon-btn sheet-close" type="button" data-sheet-close aria-label="Cerrar ajustes">
            ${utils.icon("close")}
          </button>
        </header>
        <div class="sheet-body"></div>
      </section>
    `;

    root.querySelector(".sheet-eyebrow").textContent = eyebrow;
    root.querySelector("#sheet-title").textContent = title;
    const subtitleElement = root.querySelector(".sheet-subtitle");
    if (subtitle) subtitleElement.textContent = subtitle;
    else subtitleElement.remove();

    const bodyContainer = root.querySelector(".sheet-body");
    if (body instanceof HTMLElement) bodyContainer.appendChild(body);
    else bodyContainer.innerHTML = String(body);

    const panel = root.querySelector(".sheet-panel");
    const backdrop = root.querySelector(".sheet-backdrop");

    backdrop.addEventListener("click", close);
    utils.$$("[data-sheet-close]", root).forEach((button) => {
      if (button !== backdrop) button.addEventListener("click", close);
    });

    instance.onKeydown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = focusableElements(panel);
      if (!focusables.length) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", instance.onKeydown);
    document.body.classList.add("has-sheet");
    session = instance;

    onMount?.({ panel, close });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.add("is-open");
        const autofocus = panel.querySelector("[data-autofocus]") || focusableElements(panel)[0] || panel;
        autofocus.focus({ preventScroll: true });
      });
    });

    return { close, panel, root };
  }

  function isOpen() {
    return Boolean(session) && !session.closing;
  }

  ML.sheet = { open, close, isOpen };
})();
