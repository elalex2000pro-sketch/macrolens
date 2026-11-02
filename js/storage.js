/* =========================================================
   Persistencia local + estado de la aplicación
   Estructura: { version, goals, days: { "YYYY-MM-DD": [meal] } }
   Los días se guardan por fecha local, así el registro se reinicia
   de forma natural al cambiar de día sin perder el historial.
   ========================================================= */
(function () {
  "use strict";

  const ML = (window.ML = window.ML || {});
  const STORAGE_KEY = "macrolens:data:v1";
  const MAX_THUMB_LENGTH = 450000;

  const DEFAULT_GOALS = Object.freeze({
    kcal: 3000,
    protein: 150,
    carbs: 340,
    fat: 85,
  });

  const listeners = new Set();
  let state = readState();

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createEmptyState() {
    return {
      version: 1,
      goals: { ...DEFAULT_GOALS },
      days: {},
    };
  }

  function numberOr(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(Math.max(number, min), max);
  }

  function normalizeGoals(raw) {
    const goals = raw && typeof raw === "object" ? raw : {};
    return {
      kcal: Math.round(numberOr(goals.kcal, DEFAULT_GOALS.kcal, 500, 10000)),
      protein: Math.round(numberOr(goals.protein, DEFAULT_GOALS.protein, 10, 600)),
      carbs: Math.round(numberOr(goals.carbs, DEFAULT_GOALS.carbs, 0, 1200)),
      fat: Math.round(numberOr(goals.fat, DEFAULT_GOALS.fat, 0, 600)),
    };
  }

  function normalizeMeal(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = String(raw.name || "").trim().slice(0, 120);
    if (!name) return null;

    const timestamp = new Date(raw.addedAt);
    const thumb = typeof raw.thumb === "string" && raw.thumb.startsWith("data:image/") && raw.thumb.length <= MAX_THUMB_LENGTH
      ? raw.thumb
      : null;

    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : ML.utils.uid(),
      name,
      kcal: Math.round(numberOr(raw.kcal, 0, 0, 20000)),
      protein: Math.round(numberOr(raw.protein, 0, 0, 2000) * 10) / 10,
      carbs: Math.round(numberOr(raw.carbs, 0, 0, 2000) * 10) / 10,
      fat: Math.round(numberOr(raw.fat, 0, 0, 2000) * 10) / 10,
      addedAt: Number.isNaN(timestamp.getTime()) ? new Date().toISOString() : timestamp.toISOString(),
      thumb,
    };
  }

  /** Valida y sanea lo leído de localStorage antes de usarlo. */
  function sanitize(raw) {
    const clean = createEmptyState();
    if (!raw || typeof raw !== "object") return clean;

    clean.goals = normalizeGoals(raw.goals);

    if (raw.days && typeof raw.days === "object" && !Array.isArray(raw.days)) {
      Object.entries(raw.days).forEach(([dateKey, meals]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Array.isArray(meals)) return;
        const normalized = meals.map(normalizeMeal).filter(Boolean);
        if (normalized.length) clean.days[dateKey] = normalized;
      });
    }

    return clean;
  }

  function readState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return createEmptyState();
      return sanitize(JSON.parse(raw));
    } catch (error) {
      console.warn("[MacroLens] No se pudo leer localStorage. Empezamos de cero.", error);
      return createEmptyState();
    }
  }

  function writeState(next) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch (error) {
      console.error("[MacroLens] Error al guardar", error);
      throw new Error("No se pudo guardar en este navegador. Libera espacio o revisa la configuración de privacidad.");
    }
  }

  function emit(event) {
    listeners.forEach((listener) => {
      try {
        listener(event, state);
      } catch (error) {
        console.error("[MacroLens] Error en un listener", error);
      }
    });
  }

  /**
   * Aplica una mutación sobre una copia, la persiste y solo entonces
   * actualiza el estado en memoria. Si localStorage falla, nada cambia.
   */
  function commit(mutator, event) {
    const next = clone(state);
    mutator(next);
    writeState(next);
    state = next;
    emit(event);
    return event;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getState() {
    return state;
  }

  function getGoals() {
    return { ...state.goals };
  }

  function getMeals(dateKey) {
    return Array.isArray(state.days[dateKey]) ? state.days[dateKey].slice() : [];
  }

  function hasMeals(dateKey) {
    return Array.isArray(state.days[dateKey]) && state.days[dateKey].length > 0;
  }

  /**
   * Añade una comida al día indicado. La miniatura ya debe venir comprimida.
   * Devuelve la comida normalizada que se ha guardado.
   */
  function addMeal(dateKey, mealInput) {
    const meal = normalizeMeal({
      ...mealInput,
      id: mealInput?.id || ML.utils.uid(),
      addedAt: mealInput?.addedAt || new Date().toISOString(),
    });
    if (!meal) throw new Error("La comida no tiene un nombre válido.");

    commit(
      (draft) => {
        if (!draft.days[dateKey]) draft.days[dateKey] = [];
        const duplicateId = draft.days[dateKey].some((item) => item.id === meal.id);
        if (duplicateId) meal.id = ML.utils.uid();
        draft.days[dateKey].push(meal);
      },
      { type: "meal:added", dateKey, meal }
    );

    return meal;
  }

  /** Elimina una comida y devuelve lo necesario para poder deshacerlo. */
  function deleteMeal(dateKey, mealId) {
    const meals = state.days[dateKey] || [];
    const index = meals.findIndex((meal) => meal.id === mealId);
    if (index === -1) return null;

    const meal = meals[index];
    commit(
      (draft) => {
        draft.days[dateKey].splice(index, 1);
      },
      { type: "meal:deleted", dateKey, meal, index }
    );

    return { meal, index };
  }

  function restoreMeal(dateKey, meal, index = Infinity) {
    if (!meal) return;
    commit(
      (draft) => {
        if (!draft.days[dateKey]) draft.days[dateKey] = [];
        const position = Math.min(Math.max(index, 0), draft.days[dateKey].length);
        draft.days[dateKey].splice(position, 0, meal);
      },
      { type: "meal:restored", dateKey, meal }
    );
  }

  /** Vacía un día completo y devuelve las comidas para un posible undo. */
  function clearDay(dateKey) {
    const meals = getMeals(dateKey);
    if (!meals.length) return [];

    commit(
      (draft) => {
        delete draft.days[dateKey];
      },
      { type: "day:cleared", dateKey, meals }
    );

    return meals;
  }

  function restoreDay(dateKey, meals) {
    if (!Array.isArray(meals) || !meals.length) return;
    commit(
      (draft) => {
        draft.days[dateKey] = clone(meals);
      },
      { type: "day:restored", dateKey, meals }
    );
  }

  function updateGoals(partial) {
    const next = normalizeGoals({ ...state.goals, ...partial });
    commit(
      (draft) => {
        draft.goals = next;
      },
      { type: "goals:updated", goals: next }
    );
    return next;
  }

  function exportJSON() {
    return JSON.stringify(state, null, 2);
  }

  ML.storage = {
    STORAGE_KEY,
    DEFAULT_GOALS,
    subscribe,
    getState,
    getGoals,
    getMeals,
    hasMeals,
    addMeal,
    deleteMeal,
    restoreMeal,
    clearDay,
    restoreDay,
    updateGoals,
    exportJSON,
  };
})();
