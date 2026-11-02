/* =========================================================
   Lógica nutricional + semáforo de rentabilidad
   Sin dependencias de la interfaz: se puede testear por separado.
   ========================================================= */
(function () {
  "use strict";

  const ML = (window.ML = window.ML || {});

  /**
   * Umbrales de densidad proteica (gramos de proteína por 100 kcal).
   * Un plato con >= 7 g/100 kcal es una fuente muy eficiente para volumen.
   */
  const THRESHOLDS = Object.freeze({ good: 7, okay: 4 });

  const TIERS = Object.freeze({
    good: {
      key: "good",
      label: "Excelente",
      light: "green",
      copy: "Mucha proteína por cada caloría. Un plato que trabaja a favor de tu masa muscular.",
    },
    okay: {
      key: "okay",
      label: "Aceptable",
      light: "amber",
      copy: "Aporta proteína, pero las calorías también pesan. Compensa el resto del día con opciones más magras.",
    },
    low: {
      key: "low",
      label: "Mejorable",
      light: "red",
      copy: "Poca proteína para las calorías que suma. Disfrútalo como excepción y prioriza fuentes magras después.",
    },
  });

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : 0;
  }

  /**
   * Rentabilidad proteica: gramos de proteína por cada 100 kcal.
   * Es la métrica que usa el semáforo de la tarjeta de resultados.
   */
  function proteinDensity(protein, kcal) {
    const calories = safeNumber(kcal);
    if (!calories) return 0;
    return (safeNumber(protein) / calories) * 100;
  }

  /**
   * Devuelve el nivel del semáforo (good | okay | low) junto con la
   * etiqueta y el consejo que se muestran en la interfaz.
   */
  function evaluateProfitability(meal) {
    const kcal = safeNumber(meal?.kcal ?? meal?.calories);
    const protein = safeNumber(meal?.protein);
    const ratio = proteinDensity(protein, kcal);

    let tier = TIERS.low;
    if (ratio >= THRESHOLDS.good) tier = TIERS.good;
    else if (ratio >= THRESHOLDS.okay) tier = TIERS.okay;

    return {
      ratio: Math.round(ratio * 10) / 10,
      tier: tier.key,
      label: tier.label,
      light: tier.light,
      copy: tier.copy,
      thresholds: THRESHOLDS,
    };
  }

  /** Suma los macros de una lista de comidas. */
  function sumMeals(meals = []) {
    return meals.reduce(
      (totals, meal) => {
        totals.kcal += safeNumber(meal.kcal);
        totals.protein += safeNumber(meal.protein);
        totals.carbs += safeNumber(meal.carbs);
        totals.fat += safeNumber(meal.fat);
        totals.count += 1;
        return totals;
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0, count: 0 }
    );
  }

  /** Clasifica una comida según su hora para mostrarla en el historial. */
  function mealType(isoDate) {
    const date = new Date(isoDate);
    const hour = Number.isNaN(date.getTime()) ? 12 : date.getHours();
    if (hour < 11) return "Desayuno";
    if (hour < 16) return "Almuerzo";
    if (hour < 19) return "Merienda";
    if (hour < 22) return "Cena";
    return "Recena";
  }

  function progressPercent(value, goal) {
    const target = safeNumber(goal);
    if (!target) return 0;
    return (safeNumber(value) / target) * 100;
  }

  /**
   * Estado del día para la tarjeta de resumen.
   * empty → sin comidas · progress → en curso · done → objetivo cubierto · over → superado
   */
  function dayStatus(totals, goals) {
    const percent = progressPercent(totals.kcal, goals.kcal);
    const remaining = Math.max((Number(goals.kcal) || 0) - totals.kcal, 0);
    const overflow = Math.max(totals.kcal - (Number(goals.kcal) || 0), 0);

    if (totals.count === 0) {
      return { key: "empty", label: "Sin comidas", percent, remaining, overflow };
    }
    if (percent > 100) {
      return { key: "over", label: "Superado", percent, remaining: 0, overflow };
    }
    if (percent >= 100) {
      return { key: "done", label: "Cubierto", percent, remaining: 0, overflow: 0 };
    }
    return { key: "progress", label: "En progreso", percent, remaining, overflow: 0 };
  }

  ML.nutrition = {
    THRESHOLDS,
    proteinDensity,
    evaluateProfitability,
    sumMeals,
    mealType,
    progressPercent,
    dayStatus,
  };
})();
