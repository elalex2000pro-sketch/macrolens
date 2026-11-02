/* =========================================================
   Ajustes: objetivos diarios, exportación y borrado del día
   ========================================================= */
(function () {
  "use strict";

  const ML = (window.ML = window.ML || {});
  const utils = ML.utils;
  const storage = ML.storage;

  const PRESETS = [
    { id: "volumen", label: "Volumen", kcal: 3000, protein: 150, carbs: 340, fat: 85 },
    { id: "mantener", label: "Mantener", kcal: 2500, protein: 130, carbs: 280, fat: 80 },
    { id: "definir", label: "Definir", kcal: 2100, protein: 160, carbs: 180, fat: 65 },
  ];

  function fieldMarkup(id, label, unit, value, min, max) {
    return `
      <div class="field">
        <label for="goal-${id}">${label}</label>
        <div class="field-control">
          <input id="goal-${id}" name="${id}" type="number" inputmode="numeric"
                 min="${min}" max="${max}" step="1" value="${value}" required>
          <span class="field-unit">${unit}</span>
        </div>
      </div>
    `;
  }

  function presetMarkup(preset) {
    return `<button class="preset-btn" type="button" data-preset='${JSON.stringify(preset)}'>${preset.label}</button>`;
  }

  /**
   * Abre la hoja de ajustes.
   * @param {{ dateKey?: string }} context Día que se ofrece vaciar.
   */
  function openSettings(context = {}) {
    const goals = storage.getGoals();
    const dateKey = context.dateKey || utils.toDateKey();
    const mealsCount = storage.getMeals(dateKey).length;
    const dateLabel = utils.formatDateHeadline(dateKey);

    const container = document.createElement("div");
    container.className = "settings-body";
    container.innerHTML = `
      <form class="settings-form" novalidate>
        <section class="sheet-section">
          <span class="sheet-section-label">${utils.icon("target")} Objetivos diarios</span>
          <p class="sheet-section-copy">Estos números mueven las barras de tu día. Puedes ajustarlos siempre que quieras.</p>
          <div class="preset-row" role="group" aria-label="Objetivos predefinidos">
            ${PRESETS.map(presetMarkup).join("")}
          </div>
          <div class="goal-fields">
            ${fieldMarkup("kcal", "Calorías", "kcal", goals.kcal, 1200, 6000)}
            ${fieldMarkup("protein", "Proteína", "g", goals.protein, 40, 400)}
            ${fieldMarkup("carbs", "Carbohidratos", "g", goals.carbs, 0, 800)}
            ${fieldMarkup("fat", "Grasas", "g", goals.fat, 20, 250)}
          </div>
          <button class="btn btn--primary btn--block sheet-save" type="submit">
            ${utils.icon("check")} Guardar objetivos
          </button>
          <p class="sheet-note">
            ${utils.icon("info")}
            Referencia para ganar masa muscular: 1,6–2,2 g de proteína por kg de peso corporal al día.
          </p>
        </section>
      </form>

      <section class="sheet-section">
        <span class="sheet-section-label">${utils.icon("download")} Tus datos</span>
        <p class="sheet-section-copy">Todo se guarda en este navegador. Descarga una copia si quieres conservarla o moverla a otro dispositivo.</p>
        <div class="sheet-actions-row">
          <button class="btn btn--ghost" type="button" data-export>${utils.icon("download")} Exportar copia</button>
          <button class="btn btn--danger" type="button" data-clear-day ${mealsCount ? "" : "disabled"}>
            ${utils.icon("trash")} Vaciar este día
          </button>
        </div>
        <p class="sheet-note">
          ${utils.icon("info")}
          “Este día” es ${utils.escapeHtml(dateLabel)} · ${utils.pluralize(mealsCount, "comida registrada", "comidas registradas")}. El borrado se puede deshacer unos segundos.
        </p>
      </section>

      <p class="sheet-note" style="margin-top:22px">
        ${utils.icon("leaf")} MacroLens · Los valores son estimaciones y no sustituyen el consejo de un profesional.
      </p>
    `;

    const sheet = ML.sheet.open({
      eyebrow: "Tu plan",
      title: "Objetivos diarios",
      subtitle: "Define el punto de referencia de las barras de tu día.",
      body: container,
      onMount: ({ close }) => {
        const form = container.querySelector(".settings-form");
        const inputs = utils.$$("input", form);
        const presetButtons = utils.$$("[data-preset]", form);
        const clearButton = container.querySelector("[data-clear-day]");
        const exportButton = container.querySelector("[data-export]");
        let clearTimer = 0;

        presetButtons.forEach((button) => {
          button.addEventListener("click", () => {
            try {
              const preset = JSON.parse(button.dataset.preset);
              inputs.forEach((input) => {
                if (preset[input.name] != null) input.value = preset[input.name];
              });
              presetButtons.forEach((item) => item.classList.remove("is-selected"));
              button.classList.add("is-selected");
            } catch (error) {
              console.warn("[MacroLens] Preset inválido", error);
            }
          });
        });

        inputs.forEach((input) => {
          input.addEventListener("input", () => {
            const min = Number(input.min);
            const max = Number(input.max);
            const value = Number(input.value);
            const invalid = !Number.isFinite(value) || value < min || value > max;
            input.closest(".field-control").style.borderColor = invalid ? "rgba(255,128,121,.55)" : "";
          });
        });

        form.addEventListener("submit", (event) => {
          event.preventDefault();

          if (!form.checkValidity()) {
            form.reportValidity();
            ML.toast.show({ message: "Revisa los valores: hay un objetivo fuera de rango.", tone: "error" });
            return;
          }

          const values = Object.fromEntries(inputs.map((input) => [input.name, Number(input.value)]));
          try {
            storage.updateGoals(values);
            close();
            ML.toast.show({ message: "Objetivos actualizados. Tus barras ya reflejan el nuevo plan." });
          } catch (error) {
            ML.toast.show({ message: error.message, tone: "error" });
          }
        });

        exportButton.addEventListener("click", () => {
          utils.downloadFile(
            `macrolens-datos-${utils.toDateKey()}.json`,
            storage.exportJSON(),
            "application/json"
          );
          ML.toast.show({ message: "Copia exportada. Guarda el archivo en un lugar seguro.", tone: "info" });
        });

        if (clearButton && !clearButton.disabled) {
          const originalHtml = clearButton.innerHTML;
          const reset = () => {
            window.clearTimeout(clearTimer);
            clearButton.classList.remove("is-confirming");
            clearButton.innerHTML = originalHtml;
          };

          clearButton.addEventListener("click", () => {
            if (!clearButton.classList.contains("is-confirming")) {
              clearButton.classList.add("is-confirming");
              clearButton.innerHTML = `${utils.icon("trash")} ¿Confirmar borrado?`;
              clearTimer = window.setTimeout(reset, 4000);
              return;
            }

            const currentMeals = storage.getMeals(dateKey);
            if (!currentMeals.length) {
              reset();
              return;
            }

            try {
              const removed = storage.clearDay(dateKey);
              close();
              ML.toast.show({
                message: `Registro del ${utils.formatDateHeadline(dateKey)} vaciado.`,
                actionLabel: "Deshacer",
                tone: "info",
                duration: 6500,
                onAction: () => {
                  try {
                    storage.restoreDay(dateKey, removed);
                    ML.toast.show({ message: "Registro restaurado." });
                  } catch (error) {
                    ML.toast.show({ message: error.message, tone: "error" });
                  }
                },
              });
            } catch (error) {
              reset();
              ML.toast.show({ message: error.message, tone: "error" });
            }
          });
        }
      },
    });

    return sheet;
  }

  ML.settings = { open: openSettings };
})();
