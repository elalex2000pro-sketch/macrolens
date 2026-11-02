/* =========================================================
   Dashboard: resumen del día, objetivos, semana e historial
   ========================================================= */
(function () {
  "use strict";

  const ML = (window.ML = window.ML || {});
  const utils = ML.utils;
  const nutrition = ML.nutrition;
  const storage = ML.storage;

  const state = {
    selectedKey: utils.toDateKey(),
  };

  let els = null;
  let liveRegion = null;
  let unsubscribe = null;

  const RING_RADIUS = 62;

  /* ---------- Tarjeta de resumen ---------- */
  function macroProgressMarkup({ id, label, value, goal, tone, unit = "g" }) {
    const rawPercent = goal > 0 ? (value / goal) * 100 : 0;
    const width = utils.clamp(rawPercent, 0, 100);
    const isOver = rawPercent > 100;
    const className = `macro-progress macro-progress--${id}${isOver ? " is-over" : ""}`;
    const dotClass = `macro-dot macro-dot--${tone}`;

    return `
      <div class="${className}" role="progressbar"
           aria-label="${label}" aria-valuemin="0" aria-valuemax="${goal}"
           aria-valuenow="${Math.min(value, goal)}"
           aria-valuetext="${utils.formatGrams(value)} de ${utils.formatGrams(goal)} gramos">
        <div class="macro-progress-top">
          <span class="macro-progress-name"><i class="${dotClass}"></i>${label}</span>
          <span class="macro-progress-pct">${utils.formatPercent(rawPercent)}</span>
        </div>
        <p class="macro-progress-value">${utils.formatGrams(value)}<small>/ ${utils.formatGrams(goal)} ${unit}</small></p>
        <div class="macro-bar"><span class="macro-bar-fill" style="width:${width}%"></span></div>
      </div>
    `;
  }

  function summaryMarkup() {
    const meals = storage.getMeals(state.selectedKey);
    const totals = nutrition.sumMeals(meals);
    const goals = storage.getGoals();
    const status = nutrition.dayStatus(totals, goals);
    const percent = status.percent;
    const fraction = utils.clamp(percent / 100, 0, 1);
    const isOver = status.key === "over";
    const isToday = utils.isToday(state.selectedKey);

    const density = totals.count > 0 && totals.kcal > 0
      ? nutrition.evaluateProfitability(totals)
      : null;

    let heading;
    if (status.key === "empty") heading = "Todo listo para empezar";
    else if (status.key === "over") heading = `Objetivo superado por <strong>${utils.formatKcal(status.overflow)} kcal</strong>`;
    else if (status.key === "done") heading = "Objetivo calórico cubierto";
    else heading = `Te faltan <strong>${utils.formatKcal(status.remaining)} kcal</strong>`;

    let copy;
    if (status.key === "empty") copy = `Objetivo: ${utils.formatKcal(goals.kcal)} kcal y ${utils.formatGrams(goals.protein)} g de proteína.`;
    else if (status.key === "over") copy = `Has superado tu objetivo de ${utils.formatKcal(goals.kcal)} kcal. Ajusta la siguiente comida sin dramatizar.`;
    else if (status.key === "done") copy = "Has alcanzado tu objetivo de calorías. Cuida la proteína del resto del día.";
    else copy = `${utils.formatPercent(percent)} de tu objetivo de ${utils.formatKcal(goals.kcal)} kcal.`;

    const remainingLabel = isOver ? "Por encima" : "Restantes";
    const remainingValue = isOver ? status.overflow : status.remaining;

    const densityMarkup = density
      ? `
        <div class="density-line">
          <span class="density-dot density-dot--${density.tier}"></span>
          <span><strong>${utils.formatRatio(density.ratio)} g</strong> de proteína / 100 kcal · ${density.label.toLowerCase()}</span>
        </div>
      `
      : `
        <div class="density-line">
          <span class="density-dot"></span>
          <span>Añade una comida para ver tu densidad proteica.</span>
        </div>
      `;

    const statusClass = {
      empty: "status-pill--empty",
      progress: "status-pill--progress",
      done: "status-pill--done",
      over: "status-pill--over",
    }[status.key];

    return `
      <article class="glass summary-card${isOver ? " is-over" : ""}">
        <div class="summary-head">
          <div class="summary-heading">
            <span class="summary-eyebrow">${isToday ? "Resumen de hoy" : "Resumen del día"}</span>
            <h2>${heading}</h2>
          </div>
          <span class="status-pill ${statusClass}">${status.label}</span>
        </div>

        <div class="summary-main">
          <div class="calorie-ring" role="img" aria-label="${utils.formatKcal(totals.kcal)} de ${utils.formatKcal(goals.kcal)} kilocalorías consumidas">
            <svg viewBox="0 0 140 140" aria-hidden="true">
              <defs>
                <linearGradient id="ring-gradient" x1="16" y1="10" x2="124" y2="130" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#8AFFD4"></stop>
                  <stop offset="0.55" stop-color="#3EE6A4"></stop>
                  <stop offset="1" stop-color="#18C98B"></stop>
                </linearGradient>
                <linearGradient id="ring-gradient-over" x1="16" y1="10" x2="124" y2="130" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#FFE2A3"></stop>
                  <stop offset="1" stop-color="#FFB84D"></stop>
                </linearGradient>
              </defs>
              <circle class="ring-track" cx="70" cy="70" r="${RING_RADIUS}"></circle>
              <circle class="ring-progress" cx="70" cy="70" r="${RING_RADIUS}" data-ring></circle>
            </svg>
            <div class="ring-center">
              <span class="ring-kcal">${utils.formatKcal(totals.kcal)}</span>
              <span class="ring-unit">kcal</span>
              <span class="ring-goal">de ${utils.formatKcal(goals.kcal)}</span>
            </div>
          </div>

          <div class="summary-numbers">
            <span class="remaining-label">${remainingLabel}</span>
            <p class="remaining-value">${utils.formatKcal(remainingValue)}<span>kcal</span></p>
            <p class="remaining-copy">${copy}</p>
            ${densityMarkup}
          </div>
        </div>

        <div class="macro-progress-grid">
          ${macroProgressMarkup({ id: "protein", label: "Proteína", value: totals.protein, goal: goals.protein, tone: "protein" })}
          ${macroProgressMarkup({ id: "carbs", label: "Carbos", value: totals.carbs, goal: goals.carbs, tone: "carbs" })}
          ${macroProgressMarkup({ id: "fat", label: "Grasas", value: totals.fat, goal: goals.fat, tone: "fat" })}
        </div>

        <div class="summary-foot">
          <span>${utils.pluralize(totals.count, "comida registrada", "comidas registradas")}</span>
          <button class="goal-link" type="button" data-open-goals>
            ${utils.icon("settings")} Ajustar objetivos
          </button>
        </div>
      </article>
    `;
  }

  /* ---------- Historial ---------- */
  function mealItemMarkup(meal) {
    const time = utils.formatTime(meal.addedAt);
    const type = nutrition.mealType(meal.addedAt);
    const name = utils.escapeHtml(meal.name);
    const thumb = meal.thumb
      ? `<img src="${meal.thumb}" alt="" loading="lazy">`
      : utils.icon("plate");

    return `
      <li class="meal-item" data-meal-id="${utils.escapeHtml(meal.id)}">
        <div class="meal-thumb">${thumb}</div>
        <div class="meal-info">
          <p class="meal-name" title="${name}">${name}</p>
          <div class="meal-meta">
            <span>${time}</span>
            <span class="meta-sep" aria-hidden="true"></span>
            <span>${type}</span>
            <span class="meta-sep" aria-hidden="true"></span>
            <span class="meta-protein">${utils.formatGrams(meal.protein)} P</span>
            <span class="meta-carbs">${utils.formatGrams(meal.carbs)} C</span>
            <span class="meta-fat">${utils.formatGrams(meal.fat)} G</span>
          </div>
        </div>
        <div class="meal-kcal">
          <strong>${utils.formatKcal(meal.kcal)}</strong>
          <span>kcal</span>
        </div>
        <button class="meal-delete" type="button" data-delete="${utils.escapeHtml(meal.id)}"
                aria-label="Eliminar ${name} del registro" title="Eliminar del registro">
          ${utils.icon("trash")}
        </button>
      </li>
    `;
  }

  function historyMarkup() {
    const meals = storage.getMeals(state.selectedKey).sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));
    const totals = nutrition.sumMeals(meals);
    const isToday = utils.isToday(state.selectedKey);

    const head = `
      <div class="history-head">
        <div class="history-heading">
          <span class="summary-eyebrow">Registro</span>
          <h2>${isToday ? "Comidas de hoy" : "Comidas del día"}</h2>
        </div>
        <div class="history-total">
          <strong>${utils.formatKcal(totals.kcal)} kcal</strong>
          <span>${utils.pluralize(totals.count, "comida", "comidas")}</span>
        </div>
      </div>
    `;

    if (!meals.length) {
      return `
        <article class="glass history-card">
          ${head}
          <div class="history-empty">
            <div class="empty-plate">${utils.icon("plate")}</div>
            <h3>${isToday ? "Tu día está en blanco" : "Ese día no tiene comidas"}</h3>
            <p>${isToday ? "Escanea tu primer plato y empieza a sumar hacia tu objetivo." : "Puedes volver a hoy o escanear algo para el día de hoy."}</p>
            <button class="btn btn--ghost btn--sm" type="button" data-scan>
              ${utils.icon("camera")} Escanear un plato
            </button>
          </div>
        </article>
      `;
    }

    return `
      <article class="glass history-card">
        ${head}
        <ol class="meal-list" aria-label="Comidas del día">
          ${meals.map(mealItemMarkup).join("")}
        </ol>
      </article>
    `;
  }

  /* ---------- Navegación por días ---------- */
  function weekStripMarkup() {
    const selectedDate = utils.fromDateKey(state.selectedKey);
    const cells = [];

    for (let offset = -3; offset <= 3; offset += 1) {
      const date = utils.addDays(selectedDate, offset);
      const key = utils.toDateKey(date);
      const isSelected = key === state.selectedKey;
      const today = utils.isToday(key);
      const future = utils.isFutureKey(key);
      const hasMeals = storage.hasMeals(key);
      const label = `${utils.weekdayLong(key)} ${utils.formatDateHeadline(key)}${future ? ", futuro" : hasMeals ? ", con comidas" : ""}`;

      cells.push(`
        <button class="day-chip${isSelected ? " is-selected" : ""}${today ? " is-today" : ""}${hasMeals ? " has-meals" : ""}"
                type="button" data-date="${key}" ${future ? "disabled" : ""}
                aria-label="${utils.escapeHtml(label)}" ${isSelected ? 'aria-pressed="true"' : 'aria-pressed="false"'}
                ${today ? 'aria-current="date"' : ""}>
          <span class="day-chip-dow">${utils.weekdayShort(key)}</span>
          <span class="day-chip-num">${date.getDate()}</span>
          <span class="day-chip-dot" aria-hidden="true"></span>
        </button>
      `);
    }

    return cells.join("");
  }

  function renderChrome() {
    if (!els) return;
    const today = utils.isToday(state.selectedKey);
    els.dateRel.textContent = utils.relativeLabel(state.selectedKey);
    els.dateFull.textContent = utils.formatDateHeadline(state.selectedKey);
    els.nextDay.disabled = today;
    els.backToday.hidden = today;
    els.weekStrip.innerHTML = weekStripMarkup();
  }

  function refresh() {
    if (!els) return;
    renderChrome();
    els.summarySlot.innerHTML = summaryMarkup();
    els.historySlot.innerHTML = historyMarkup();

    const ring = els.summarySlot.querySelector("[data-ring]");
    const totals = nutrition.sumMeals(storage.getMeals(state.selectedKey));
    const goals = storage.getGoals();
    const fraction = goals.kcal > 0 ? totals.kcal / goals.kcal : 0;
    utils.animateRing(ring, RING_RADIUS, fraction);
    utils.$$(".macro-bar-fill", els.summarySlot).forEach(utils.animateBar);
    utils.animateNumber(els.summarySlot.querySelector(".ring-kcal"), totals.kcal, { duration: 850 });
  }

  function setDate(dateKey, options = {}) {
    let nextKey = typeof dateKey === "string" ? dateKey : utils.toDateKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextKey)) nextKey = utils.toDateKey();
    if (utils.isFutureKey(nextKey)) nextKey = utils.toDateKey();

    state.selectedKey = nextKey;
    refresh();

    if (options.announce !== false && liveRegion) {
      liveRegion.textContent = `Viendo ${utils.formatLongDate(nextKey)}.`;
    }
  }

  function changeDay(delta) {
    setDate(utils.toDateKey(utils.addDays(utils.fromDateKey(state.selectedKey), delta)));
  }

  function openGoals() {
    ML.settings.open({ dateKey: state.selectedKey });
  }

  function onWeekStripClick(event) {
    const button = event.target.closest("[data-date]");
    if (!button || button.disabled) return;
    setDate(button.dataset.date);
  }

  function onSummaryClick(event) {
    if (event.target.closest("[data-open-goals]")) openGoals();
  }

  function onHistoryClick(event) {
    const scanButton = event.target.closest("[data-scan]");
    if (scanButton) {
      ML.app?.go?.("scanner");
      return;
    }

    const deleteButton = event.target.closest("[data-delete]");
    if (!deleteButton) return;

    const mealId = deleteButton.dataset.delete;
    const dateKey = state.selectedKey;
    const meal = storage.getMeals(dateKey).find((item) => item.id === mealId);
    if (!meal) return;

    try {
      const removed = storage.deleteMeal(dateKey, mealId);
      if (!removed) return;
      liveRegionAnnounce(`${meal.name} eliminado del registro.`);
      ML.toast.show({
        message: `${meal.name} eliminado.`,
        tone: "info",
        actionLabel: "Deshacer",
        duration: 6000,
        onAction: () => {
          try {
            storage.restoreMeal(dateKey, removed.meal, removed.index);
            liveRegionAnnounce(`${meal.name} restaurado.`);
          } catch (error) {
            ML.toast.show({ message: error.message, tone: "error" });
          }
        },
      });
    } catch (error) {
      ML.toast.show({ message: error.message, tone: "error" });
    }
  }

  function liveRegionAnnounce(message) {
    if (!liveRegion) return;
    liveRegion.textContent = "";
    window.setTimeout(() => {
      liveRegion.textContent = message;
    }, 40);
  }

  function init() {
    els = {
      dateRel: document.getElementById("date-rel"),
      dateFull: document.getElementById("date-full"),
      prevDay: document.getElementById("prev-day"),
      nextDay: document.getElementById("next-day"),
      backToday: document.getElementById("back-today"),
      weekStrip: document.getElementById("week-strip"),
      summarySlot: document.getElementById("summary-slot"),
      historySlot: document.getElementById("history-slot"),
    };

    if (!els.dateRel || !els.summarySlot || !els.historySlot) return;

    liveRegion = document.createElement("p");
    liveRegion.className = "sr-only";
    liveRegion.id = "dashboard-live-status";
    liveRegion.setAttribute("aria-live", "polite");
    document.body.appendChild(liveRegion);

    els.prevDay.addEventListener("click", () => changeDay(-1));
    els.nextDay.addEventListener("click", () => changeDay(1));
    els.backToday.addEventListener("click", () => setDate(utils.toDateKey()));
    els.weekStrip.addEventListener("click", onWeekStripClick);
    els.summarySlot.addEventListener("click", onSummaryClick);
    els.historySlot.addEventListener("click", onHistoryClick);

    unsubscribe = storage.subscribe(() => refresh());
    setDate(utils.toDateKey(), { announce: false });
  }

  function destroy() {
    unsubscribe?.();
    unsubscribe = null;
  }

  ML.dashboard = {
    init,
    refresh,
    setDate,
    getSelectedDate: () => state.selectedKey,
    destroy,
  };
})();
