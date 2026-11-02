/* =========================================================
   Utilidades compartidas (fechas, formato, DOM y animación)
   ========================================================= */
(function () {
  "use strict";

  const ML = (window.ML = window.ML || {});

  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

  const MAX_FILE_BYTES = 15 * 1024 * 1024;

  const intFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 0 });
  const gramsFmt = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });
  const ratioFmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const timeFmt = new Intl.DateTimeFormat("es-ES", { hour: "2-digit", minute: "2-digit" });
  const longDateFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const headlineFmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long" });
  const weekdayShortFmt = new Intl.DateTimeFormat("es-ES", { weekday: "short" });
  const weekdayLongFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long" });

  function icon(name, className = "icon") {
    return `<svg class="${className}" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function capitalize(text = "") {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function uid() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `ml-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function pluralize(count, singular, plural) {
    return `${count} ${count === 1 ? singular : plural}`;
  }

  function formatKcal(value) {
    return intFmt.format(Math.round(Number(value) || 0));
  }

  function formatGrams(value) {
    return gramsFmt.format(Number(value) || 0);
  }

  function formatRatio(value) {
    return ratioFmt.format(Number(value) || 0);
  }

  function formatPercent(value) {
    return `${Math.round(Number(value) || 0)}%`;
  }

  /* ----- Fechas (siempre en hora local, nunca UTC) ----- */
  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function toDateKey(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function fromDateKey(key) {
    const [year, month, day] = String(key).split("-").map(Number);
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  function addDays(date, delta) {
    const next = new Date(date);
    next.setDate(next.getDate() + delta);
    return next;
  }

  function isToday(key) {
    return key === toDateKey(new Date());
  }

  function isFutureKey(key) {
    return key > toDateKey(new Date());
  }

  function dayDiff(key) {
    const today = fromDateKey(toDateKey(new Date()));
    const day = fromDateKey(key);
    return Math.round((today - day) / 86400000);
  }

  function weekdayShort(key) {
    return weekdayShortFmt.format(fromDateKey(key)).replace(".", "");
  }

  function weekdayLong(key) {
    return capitalize(weekdayLongFmt.format(fromDateKey(key)));
  }

  function formatLongDate(key) {
    return capitalize(longDateFmt.format(fromDateKey(key)));
  }

  function formatDateHeadline(key) {
    const date = fromDateKey(key);
    const base = capitalize(headlineFmt.format(date));
    const currentYear = new Date().getFullYear();
    return date.getFullYear() === currentYear ? base : `${base} de ${date.getFullYear()}`;
  }

  function relativeLabel(key) {
    const diff = dayDiff(key);
    if (diff === 0) return "Hoy";
    if (diff === 1) return "Ayer";
    return weekdayLong(key);
  }

  function formatTime(iso) {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "--:--" : timeFmt.format(date);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /* ----- Animación ----- */
  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  function animateNumber(element, to, options = {}) {
    if (!element) return;
    const { duration = 750, from = 0, format = formatKcal } = options;

    if (prefersReducedMotion() || duration <= 0) {
      element.textContent = format(to);
      return;
    }

    const start = performance.now();
    const initial = Number(from) || 0;
    const target = Number(to) || 0;

    function tick(now) {
      const progress = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = format(initial + (target - initial) * eased);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        element.textContent = format(target);
      }
    }

    requestAnimationFrame(tick);
  }

  function animateBar(element) {
    if (!element || prefersReducedMotion() || typeof element.animate !== "function") return;
    element.animate(
      [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
      { duration: 750, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }
    );
  }

  function animateRing(circle, radius, fraction) {
    if (!circle) return;
    const circumference = 2 * Math.PI * radius;
    const target = circumference * (1 - clamp(fraction, 0, 1));
    circle.style.strokeDasharray = String(circumference);
    circle.style.strokeDashoffset = String(circumference);

    if (prefersReducedMotion()) {
      circle.style.strokeDashoffset = String(target);
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        circle.style.strokeDashoffset = String(target);
      });
    });
  }

  function scrollToElement(element) {
    if (!element) return;
    element.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }

  /* ----- Archivos ----- */
  function validateImageFile(file) {
    if (!file) return { ok: false, message: "No se ha seleccionado ninguna imagen." };
    if (!file.type?.startsWith("image/")) {
      return { ok: false, message: "Ese archivo no es una imagen. Prueba con JPG, PNG o WEBP." };
    }
    if (file.size > MAX_FILE_BYTES) {
      return { ok: false, message: "La imagen pesa demasiado. El máximo es 15 MB." };
    }
    return { ok: true, message: "" };
  }

  /**
   * Reduce la foto a una miniatura JPEG para poder guardarla en localStorage
   * sin agotar la cuota del navegador. Devuelve null si no se puede procesar.
   */
  function compressImage(file, maxSide = 380, quality = 0.72) {
    return new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();

      const cleanup = () => URL.revokeObjectURL(objectUrl);

      image.onload = () => {
        try {
          const largest = Math.max(image.width, image.height) || 1;
          const scale = Math.min(1, maxSide / largest);
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext("2d");
          context.fillStyle = "#07120f";
          context.fillRect(0, 0, width, height);
          context.drawImage(image, 0, 0, width, height);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          cleanup();
          resolve(dataUrl.startsWith("data:image/") ? dataUrl : null);
        } catch (error) {
          cleanup();
          console.warn("[MacroLens] No se pudo comprimir la imagen", error);
          resolve(null);
        }
      };

      image.onerror = () => {
        cleanup();
        resolve(null);
      };

      image.src = objectUrl;
    });
  }

  function downloadFile(filename, content, mime = "application/json") {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  ML.utils = {
    $,
    $$,
    icon,
    clamp,
    round1,
    capitalize,
    uid,
    pluralize,
    formatKcal,
    formatGrams,
    formatRatio,
    formatPercent,
    toDateKey,
    fromDateKey,
    addDays,
    isToday,
    isFutureKey,
    dayDiff,
    weekdayShort,
    weekdayLong,
    formatLongDate,
    formatDateHeadline,
    relativeLabel,
    formatTime,
    escapeHtml,
    prefersReducedMotion,
    animateNumber,
    animateBar,
    animateRing,
    scrollToElement,
    validateImageFile,
    compressImage,
    downloadFile,
    MAX_FILE_BYTES,
  };
})();
