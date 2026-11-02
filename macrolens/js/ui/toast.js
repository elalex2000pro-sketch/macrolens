/* =========================================================
   Toasts accesibles con acción opcional (p. ej. Deshacer)
   ========================================================= */
(function () {
  "use strict";

  const ML = (window.ML = window.ML || {});
  const utils = ML.utils;
  const root = document.getElementById("toast-root");

  function dismiss(element) {
    if (!element || element.classList.contains("is-leaving")) return;
    element.classList.add("is-leaving");
    window.setTimeout(() => element.remove(), 240);
  }

  /** Cierra todos los avisos visibles (p. ej. al abrir una hoja). */
  function dismissAll() {
    if (!root) return;
    Array.from(root.children).forEach(dismiss);
  }

  /**
   * @param {{ message: string, tone?: "success"|"error"|"info", actionLabel?: string,
   *           onAction?: Function, duration?: number, iconName?: string }} options
   */
  function show(options = {}) {
    const {
      message = "",
      tone = "success",
      actionLabel = "",
      onAction = null,
      duration = actionLabel ? 6000 : 4200,
      iconName = tone === "error" ? "info" : tone === "info" ? "info" : "check",
    } = options;

    if (!root) return () => {};

    while (root.children.length >= 3) root.firstElementChild?.remove();

    const toast = document.createElement("div");
    toast.className = `toast toast--${tone}`;
    toast.setAttribute("role", "status");
    toast.innerHTML = `
      <span class="toast-icon">${utils.icon(iconName)}</span>
      <p class="toast-message"></p>
      ${actionLabel ? `<button class="toast-action" type="button"></button>` : ""}
      <button class="toast-close" type="button" aria-label="Cerrar aviso">${utils.icon("close")}</button>
    `;

    toast.querySelector(".toast-message").textContent = message;

    const actionButton = toast.querySelector(".toast-action");
    if (actionButton) {
      actionButton.textContent = actionLabel;
      actionButton.addEventListener("click", () => {
        try {
          onAction?.();
        } finally {
          dismiss(toast);
        }
      });
    }

    toast.querySelector(".toast-close").addEventListener("click", () => dismiss(toast));
    root.appendChild(toast);

    let remaining = duration;
    let startedAt = Date.now();
    let timer = 0;

    const pause = () => {
      window.clearTimeout(timer);
      remaining -= Date.now() - startedAt;
    };

    const resume = () => {
      if (remaining < 700 || toast.classList.contains("is-leaving")) return;
      startedAt = Date.now();
      timer = window.setTimeout(() => dismiss(toast), remaining);
    };

    startedAt = Date.now();
    timer = window.setTimeout(() => dismiss(toast), remaining);
    toast.addEventListener("mouseenter", pause);
    toast.addEventListener("mouseleave", resume);
    toast.addEventListener("focusin", pause);
    toast.addEventListener("focusout", resume);

    return () => dismiss(toast);
  }

  ML.toast = { show, dismiss, dismissAll };
})();
