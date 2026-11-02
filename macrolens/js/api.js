/* =========================================================
   Capa de análisis de imágenes
   Ahora mismo devuelve un mock. El resto de la app solo conoce
   el contrato de datos, así que conectar la IA real es cambiar
   esta capa, no la interfaz.
   ========================================================= */
(function () {
  "use strict";

  const ML = (window.ML = window.ML || {});

  /**
   * Respuesta fija de demostración.
   * Macros coherentes con las kcal: 35*4 + 73*4 + 24*9 = 648 kcal aprox.
   * @typedef {Object} FoodAnalysis
   * @property {string} dish
   * @property {number} calories
   * @property {number} protein
   * @property {number} carbs
   * @property {number} fat
   * @property {number} confidence
   * @property {string} portion
   * @property {string[]} ingredients
   * @property {boolean} mock
   */
  const MOCK_RESULT = Object.freeze({
    dish: "Lentejas con chorizo",
    calories: 650,
    protein: 35,
    carbs: 73,
    fat: 24,
    confidence: 0.93,
    portion: "1 plato mediano · ≈ 450 g",
    ingredients: ["Lentejas", "Chorizo", "Zanahoria", "Cebolla", "Pimentón"],
  });

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Simula el análisis multimodal de una foto.
   * Tarda 2 s y devuelve siempre el mismo plato de ejemplo,
   * suficiente para probar la UI, el semáforo y el registro diario.
   *
   * Para la versión real: sustituye esta función por `analyzeFoodImage`
   * o haz que esta llame a tu backend.
   *
   * @param {File} file
   * @returns {Promise<FoodAnalysis>}
   */
  async function mockAnalyzeImage(file) {
    if (!file) throw new Error("No hay ninguna imagen que analizar.");
    await wait(2000);

    return {
      ...MOCK_RESULT,
      ingredients: [...MOCK_RESULT.ingredients],
      analyzedAt: new Date().toISOString(),
      mock: true,
    };
  }

  /** Convierte respuestas habituales de una API en el contrato de la app. */
  function normalizeAnalysis(raw) {
    if (!raw || typeof raw !== "object") {
      throw new Error("La API devolvió una respuesta vacía.");
    }

    const source = raw.result && typeof raw.result === "object" ? raw.result : raw;
    const dish = source.dish || source.name || source.food || source.title;
    const calories = Number(source.calories ?? source.kcal);
    const protein = Number(source.protein);
    const carbs = Number(source.carbs ?? source.carbohydrates);
    const fat = Number(source.fat);

    if (!dish || ![calories, protein, carbs, fat].every(Number.isFinite)) {
      throw new Error("La respuesta de la API no incluye nombre, kcal y macros válidos.");
    }

    return {
      dish: String(dish).slice(0, 120),
      calories: Math.max(0, Math.round(calories)),
      protein: Math.max(0, Math.round(protein * 10) / 10),
      carbs: Math.max(0, Math.round(carbs * 10) / 10),
      fat: Math.max(0, Math.round(fat * 10) / 10),
      confidence: Number.isFinite(Number(source.confidence)) ? Number(source.confidence) : null,
      portion: source.portion ? String(source.portion) : "1 ración estimada",
      ingredients: Array.isArray(source.ingredients) ? source.ingredients.map(String).slice(0, 8) : [],
      analyzedAt: new Date().toISOString(),
      mock: false,
    };
  }

  /**
   * Punto de integración con una API real (DeepSeek, Gemini, etc.).
   * IMPORTANTE: no pongas claves de API en el navegador. Envía la foto
   * a tu propio backend (/api/analyze) y que ese servidor hable con la IA.
   *
   * @param {File} file
   * @param {{ endpoint?: string }} [options]
   * @returns {Promise<FoodAnalysis>}
   */
  async function analyzeFoodImage(file, options = {}) {
    const endpoint = options.endpoint || "/api/analyze";
    const body = new FormData();
    body.append("image", file);

    const response = await fetch(endpoint, { method: "POST", body });
    if (!response.ok) {
      throw new Error(`El análisis falló (${response.status}). Inténtalo de nuevo.`);
    }

    return normalizeAnalysis(await response.json());
  }

  ML.api = {
    MOCK_RESULT,
    mockAnalyzeImage,
    analyzeFoodImage,
    normalizeAnalysis,
  };
})();
