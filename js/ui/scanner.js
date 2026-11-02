/* =========================================================
   Vista del escáner: selección de foto, análisis simulado,
   tarjeta de resultados y alta en el registro de hoy.
   ========================================================= */
(function () {
  "use strict";

  const ML = (window.ML = window.ML || {});
  const utils = ML.utils;
  const nutrition = ML.nutrition;
  const storage = ML.storage;

  const SCAN_MESSAGES = [
    "Leyendo los ingredientes…",
    "Estimando la ración…",
    "Calculando calorías y macros…",
    "Evaluando la rentabilidad…",
  ];

  const state = {
    phase: "idle", // idle | analyzing | ready | added
    file: null,
    previewUrl: null,
    result: null,
    runId: 0,
    statusTimer: 0,
    statusIndex: 0,
    saving: false,
  };

  let scanCard = null;
  let scanStage = null;
  let scanSide = null;
  let cameraInput = null;
  let galleryInput = null;
  let liveRegion = null;

  /* ---------- Render ---------- */
  function idleStageMarkup() {
    return `
      <div class="stage-idle">
        <div class="lens-visual" aria-hidden="true">
          <span class="lens-ring-outer"></span>
          <span class="lens-ring-inner"></span>
          <span class="lens-core">${utils.icon("camera")}</span>
          <span class="lens-orbit-dot"></span>
        </div>
        <h2>Tu plato, en un vistazo</h2>
        <p>Haz una foto clara y deja que el análisis haga el resto.</p>
        <div class="scan-actions">
          <button class="btn btn--primary btn--lg btn--block" type="button" data-action="camera">
            ${utils.icon("camera")} Hacer foto
          </button>
          <button class="btn btn--ghost btn--lg btn--block" type="button" data-action="gallery">
            ${utils.icon("image")} Subir imagen
          </button>
        </div>
        <p class="format-hint">JPG, PNG o WEBP · máximo 15 MB</p>
      </div>
    `;
  }

  function idleSideMarkup() {
    const { good, okay } = nutrition.THRESHOLDS;
    return `
      <article class="glass info-card">
        <span class="eyebrow">${utils.icon("sparkles")} Tu ventaja</span>
        <h2>El semáforo que mira por tu proteína.</h2>
        <p>No todas las calorías construyen músculo. Comparamos la proteína con la energía del plato para darte una señal rápida.</p>
        <div class="how-list">
          <div class="how-item">
            <span class="how-num">01</span>
            <div>
              <strong>Sube una foto</strong>
              <p>Una imagen nítida del plato completo es suficiente.</p>
            </div>
          </div>
          <div class="how-item">
            <span class="how-num">02</span>
            <div>
              <strong>Lee el semáforo</strong>
              <p>Verde, ámbar o rojo según los gramos de proteína por cada 100 kcal.</p>
            </div>
          </div>
          <div class="how-item">
            <span class="how-num">03</span>
            <div>
              <strong>Súmalo a tu día</strong>
              <p>El registro se actualiza en el momento y se guarda en tu navegador.</p>
            </div>
          </div>
        </div>
        <div class="semaforo-legend" aria-label="Umbrales del semáforo">
          <span class="legend-item legend-item--good"><span class="legend-dot"></span>≥ ${good} g</span>
          <span class="legend-item legend-item--okay"><span class="legend-dot"></span>${okay}–${good} g</span>
          <span class="legend-item legend-item--low"><span class="legend-dot"></span>&lt; ${okay} g</span>
          <span class="legend-item" style="color:var(--muted)">proteína / 100 kcal</span>
        </div>
      </article>
    `;
  }

  function previewTopMarkup(mode) {
    if (mode === "analyzing") {
      return `
        <div class="preview-top">
          <span class="glass-chip glass-chip--accent">${utils.icon("scan")} Analizando foto</span>
          <button class="glass-chip glass-chip--button" type="button" data-action="cancel">
            ${utils.icon("close")} Cancelar
          </button>
        </div>
      `;
    }

    return `
      <div class="preview-top">
        <span class="glass-chip">${utils.icon("check")} Foto analizada</span>
        <button class="glass-chip glass-chip--button" type="button" data-action="gallery">
          ${utils.icon("camera")} Cambiar foto
        </button>
      </div>
    `;
  }

  function analyzingStageMarkup() {
    return `
      <div class="stage-preview">
        <img src="${state.previewUrl}" alt="Foto del plato que se está analizando">
        ${previewTopMarkup("analyzing")}
        <div class="scan-overlay">
          <span class="scan-beam" aria-hidden="true"></span>
          <span class="scan-frame" aria-hidden="true"><span></span><span></span><span></span><span></span></span>
          <div class="analysis-box">
            <span class="scanner-spinner" aria-hidden="true">${utils.icon("scan")}</span>
            <div class="analysis-copy">
              <strong>
                <span class="analysis-status">Analizando la imagen…</span>
                <span class="analysis-dots" aria-hidden="true"><i></i><i></i><i></i></span>
              </strong>
              <span>La IA de demostración tarda unos 2 segundos</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function readyStageMarkup() {
    const dish = utils.escapeHtml(state.result?.dish || "plato");
    const markText = state.phase === "added" ? "Añadido a tu registro de hoy" : "Listo para registrar";
    return `
      <div class="stage-preview">
        <img src="${state.previewUrl}" alt="Foto del plato analizado: ${dish}">
        ${previewTopMarkup("ready")}
        <span class="preview-ready-mark">${utils.icon("check")} ${markText}</span>
      </div>
    `;
  }

  function skeletonMarkup() {
    return `
      <article class="glass skeleton-card" aria-hidden="true">
        <div class="sk sk--eyebrow"></div>
        <div class="sk sk--title"></div>
        <div class="sk sk--sub"></div>
        <div class="sk sk--kcal"></div>
        <div class="sk-grid">
          <div class="sk sk--macro"></div>
          <div class="sk sk--macro"></div>
          <div class="sk sk--macro"></div>
        </div>
        <div class="sk sk--band"></div>
        <div class="sk sk--cta"></div>
      </article>
    `;
  }

  function profitMarkup(analysis) {
    const lights = ["red", "amber", "green"];
    const activeLight = analysis.tier === "good" ? "green" : analysis.tier === "okay" ? "amber" : "red";
    const lightMarkup = lights
      .map((light) => `<span class="traffic-light traffic-light--${light}${light === activeLight ? " is-on" : ""}"></span>`)
      .join("");

    return `
      <section class="profit-card profit-card--${analysis.tier}" aria-label="Semáforo de rentabilidad: ${analysis.label}">
        <div class="profit-head">
          <span class="profit-title">${utils.icon("target")} Semáforo de rentabilidad</span>
          <span class="traffic" role="img" aria-label="Nivel ${analysis.label}">${lightMarkup}</span>
        </div>
        <div class="profit-main">
          <p class="profit-ratio">${utils.formatRatio(analysis.ratio)} <small>g de proteína / 100 kcal</small></p>
          <span class="profit-tier">${analysis.label}</span>
        </div>
        <p class="profit-copy">${analysis.copy}</p>
        <div class="profit-scale" aria-hidden="true">
          <span class="profit-zone profit-zone--low"></span>
          <span class="profit-zone profit-zone--okay"></span>
          <span class="profit-zone profit-zone--good"></span>
        </div>
        <div class="profit-scale-labels" aria-hidden="true">
          <span>Bajo</span><span>Aceptable</span><span>Excelente</span>
        </div>
      </section>
    `;
  }

  function resultMarkup() {
    const result = state.result;
    if (!result) return "";
    const analysis = nutrition.evaluateProfitability(result);
    const dish = utils.escapeHtml(result.dish);
    const ingredients = Array.isArray(result.ingredients) ? result.ingredients.slice(0, 5) : [];
    const ingredientsMarkup = ingredients.length
      ? `<div class="ingredient-row">${ingredients.map((item) => `<span class="ingredient-chip">${utils.escapeHtml(item)}</span>`).join("")}</div>`
      : "";

    const actions = state.phase === "added"
      ? `
        <div class="added-banner">${utils.icon("check")} Añadido al registro de hoy</div>
        <div class="result-actions">
          <button class="btn btn--primary" type="button" data-action="view-day">
            Ver mi día ${utils.icon("arrow")}
          </button>
          <button class="btn btn--ghost" type="button" data-action="reset">
            ${utils.icon("scan")} Escanear otro
          </button>
        </div>
      `
      : `
        <div class="result-actions">
          <button class="btn btn--primary btn--lg btn--block" type="button" data-action="add">
            ${utils.icon("check")} Añadir al registro de hoy
          </button>
        </div>
      `;

    return `
      <article class="glass result-card" tabindex="-1">
        <div class="result-topline">
          <span class="summary-eyebrow">Resultado del análisis</span>
          ${result.mock ? '<span class="demo-chip">Demo IA</span>' : ""}
        </div>
        <h2 id="result-title" tabindex="-1">${dish}</h2>
        <p class="result-portion">${utils.escapeHtml(result.portion || "1 ración estimada")}</p>
        ${ingredientsMarkup}
        <div class="kcal-block">
          <span class="kcal-value">${utils.formatKcal(result.calories)}</span>
          <span class="kcal-unit">kcal</span>
          <span class="kcal-note">estimadas</span>
        </div>
        <div class="macro-grid">
          <div class="macro-tile">
            <span class="macro-tile-label"><i class="macro-dot macro-dot--protein"></i>Proteína</span>
            <p class="macro-tile-value">${utils.formatGrams(result.protein)}<small>g</small></p>
          </div>
          <div class="macro-tile">
            <span class="macro-tile-label"><i class="macro-dot macro-dot--carbs"></i>Carbohidratos</span>
            <p class="macro-tile-value">${utils.formatGrams(result.carbs)}<small>g</small></p>
          </div>
          <div class="macro-tile">
            <span class="macro-tile-label"><i class="macro-dot macro-dot--fat"></i>Grasas</span>
            <p class="macro-tile-value">${utils.formatGrams(result.fat)}<small>g</small></p>
          </div>
        </div>
        ${profitMarkup(analysis)}
        ${actions}
        <p class="result-disclaimer">
          ${result.mock ? "Análisis simulado de demostración." : "Estimación automática."}
          Los valores son orientativos y pueden variar según la receta y la ración.
        </p>
      </article>
    `;
  }

  function render() {
    if (!scanStage || !scanSide) return;

    if (state.phase === "idle") {
      scanStage.innerHTML = idleStageMarkup();
      scanSide.innerHTML = idleSideMarkup();
      return;
    }

    if (state.phase === "analyzing") {
      scanStage.innerHTML = analyzingStageMarkup();
      scanSide.innerHTML = skeletonMarkup();
      return;
    }

    scanStage.innerHTML = readyStageMarkup();
    scanSide.innerHTML = resultMarkup();
  }

  /* ---------- Anuncios para lectores de pantalla ---------- */
  function announce(message) {
    if (!liveRegion) return;
    liveRegion.textContent = "";
    window.setTimeout(() => {
      liveRegion.textContent = message;
    }, 50);
  }

  function stopStatusCycle() {
    window.clearInterval(state.statusTimer);
    state.statusTimer = 0;
  }

  function startStatusCycle() {
    stopStatusCycle();
    state.statusIndex = 0;
    const label = scanStage.querySelector(".analysis-status");

    state.statusTimer = window.setInterval(() => {
      state.statusIndex = (state.statusIndex + 1) % SCAN_MESSAGES.length;
      const current = scanStage.querySelector(".analysis-status");
      if (current) current.textContent = SCAN_MESSAGES[state.statusIndex];
    }, 700);

    if (label) label.textContent = SCAN_MESSAGES[0];
  }

  function releasePreview() {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
      state.previewUrl = null;
    }
  }

  /* ---------- Flujo de archivo ---------- */
  function loadPreview(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => resolve(url);
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No hemos podido abrir esa imagen. Prueba con un JPG o PNG."));
      };
      image.src = url;
    });
  }

  function resetToIdle() {
    state.runId += 1;
    stopStatusCycle();
    releasePreview();
    state.phase = "idle";
    state.file = null;
    state.result = null;
    state.saving = false;
    render();
  }

  async function startAnalysis(file) {
    const validation = utils.validateImageFile(file);
    if (!validation.ok) {
      ML.toast.show({ message: validation.message, tone: "error" });
      return;
    }

    if (state.phase === "analyzing") {
      ML.toast.show({ message: "Espera a que termine el análisis en curso.", tone: "info" });
      return;
    }

    if (state.saving) {
      ML.toast.show({ message: "Un momento: estamos guardando el plato anterior.", tone: "info" });
      return;
    }

    let previewUrl = "";
    try {
      previewUrl = await loadPreview(file);
    } catch (error) {
      ML.toast.show({ message: error.message, tone: "error" });
      return;
    }

    releasePreview();
    state.runId += 1;
    const runId = state.runId;
    state.phase = "analyzing";
    state.file = file;
    state.previewUrl = previewUrl;
    state.result = null;
    state.saving = false;
    render();
    startStatusCycle();
    announce("Analizando la imagen del plato. Espera unos segundos.");

    try {
      const result = await ML.api.mockAnalyzeImage(file);
      if (runId !== state.runId || state.phase !== "analyzing") return;

      stopStatusCycle();
      state.result = result;
      state.phase = "ready";
      render();
      announce(`Análisis completado. ${result.dish}. ${utils.formatKcal(result.calories)} kilocalorías y ${utils.formatGrams(result.protein)} gramos de proteína.`);

      const resultCard = scanSide.querySelector(".result-card");
      if (window.matchMedia("(max-width: 879px)").matches) {
        window.setTimeout(() => utils.scrollToElement(resultCard), 100);
      }
      window.setTimeout(() => {
        const title = scanSide.querySelector("#result-title");
        title?.focus({ preventScroll: true });
      }, 450);
    } catch (error) {
      if (runId !== state.runId) return;
      stopStatusCycle();
      resetToIdle();
      ML.toast.show({ message: error.message || "No se pudo analizar la imagen.", tone: "error" });
    }
  }

  function openPicker(input) {
    if (!input) return;
    input.value = "";
    input.click();
  }

  function handleInput(event) {
    const file = event.target.files?.[0];
    if (file) startAnalysis(file);
    event.target.value = "";
  }

  async function addCurrentMeal(button) {
    if (!state.result || state.phase !== "ready" || state.saving) return;

    state.saving = true;
    const originalHtml = button.innerHTML;
    button.disabled = true;
    button.textContent = "Guardando plato…";

    try {
      const thumb = state.file ? await utils.compressImage(state.file) : null;
      const today = utils.toDateKey();
      const result = state.result;
      const meal = storage.addMeal(today, {
        name: result.dish,
        kcal: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        thumb,
        addedAt: new Date().toISOString(),
      });

      state.saving = false;
      state.phase = "added";
      render();
      announce(`${meal.name} añadido al registro de hoy.`);
      ML.toast.show({
        message: `${meal.name} añadido a tu día.`,
        actionLabel: "Ver mi día",
        duration: 6500,
        onAction: () => ML.app?.go?.("dashboard", { dateKey: today }),
      });
    } catch (error) {
      state.saving = false;
      button.disabled = false;
      button.innerHTML = originalHtml;
      ML.toast.show({ message: error.message || "No se pudo guardar la comida.", tone: "error" });
    }
  }

  /* ---------- Eventos ---------- */
  function onStageClick(event) {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    const action = trigger.dataset.action;

    if (action === "camera") openPicker(cameraInput);
    else if (action === "gallery") openPicker(galleryInput);
    else if (action === "cancel") resetToIdle();
  }

  function onSideClick(event) {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    const action = trigger.dataset.action;

    if (action === "add") addCurrentMeal(trigger);
    else if (action === "reset") resetToIdle();
    else if (action === "view-day") {
      ML.app?.go?.("dashboard", { dateKey: utils.toDateKey() });
    }
  }

  function setupDragAndDrop() {
    let dragDepthLocal = 0;

    scanCard.addEventListener("dragenter", (event) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      event.preventDefault();
      if (state.phase === "analyzing" || state.saving) return;
      dragDepthLocal += 1;
      scanCard.classList.add("is-dragging");
    });

    scanCard.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types?.includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });

    scanCard.addEventListener("dragleave", () => {
      dragDepthLocal = Math.max(0, dragDepthLocal - 1);
      if (dragDepthLocal === 0) scanCard.classList.remove("is-dragging");
    });

    scanCard.addEventListener("drop", (event) => {
      event.preventDefault();
      dragDepthLocal = 0;
      scanCard.classList.remove("is-dragging");
      if (state.phase === "analyzing" || state.saving) return;
      const file = event.dataTransfer?.files?.[0];
      if (file) startAnalysis(file);
    });

    // Evita que soltar un archivo fuera de la tarjeta abra el navegador.
    window.addEventListener("dragover", (event) => {
      if (event.dataTransfer?.types?.includes("Files")) event.preventDefault();
    });
    window.addEventListener("drop", (event) => {
      if (event.dataTransfer?.types?.includes("Files") && !scanCard.contains(event.target)) {
        event.preventDefault();
      }
    });
  }

  function init() {
    scanCard = document.getElementById("scan-card");
    scanStage = document.getElementById("scan-stage");
    scanSide = document.getElementById("scan-side");
    cameraInput = document.getElementById("input-camera");
    galleryInput = document.getElementById("input-gallery");

    if (!scanCard || !scanStage || !scanSide) return;

    liveRegion = document.createElement("p");
    liveRegion.className = "sr-only";
    liveRegion.id = "scanner-live-status";
    liveRegion.setAttribute("aria-live", "polite");
    document.body.appendChild(liveRegion);

    cameraInput?.addEventListener("change", handleInput);
    galleryInput?.addEventListener("change", handleInput);
    scanStage.addEventListener("click", onStageClick);
    scanSide.addEventListener("click", onSideClick);
    setupDragAndDrop();

    render();
  }

  ML.scanner = {
    init,
    reset: resetToIdle,
  };
})();
