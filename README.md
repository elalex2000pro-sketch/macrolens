# MacroLens

MacroLens es un registro nutricional personal, mobile-first, con estética glassmorphism oscura y acentos esmeralda. Analiza una foto de tu plato (simulado en esta versión), estima calorías y macros, evalúa la **rentabilidad proteica** con un semáforo y guarda tu día en el navegador.

**Demo:** https://macrolens-two.vercel.app/  
**Repositorio:** https://github.com/elalex2000pro-sketch/macrolens

## Funcionalidad

- **Escáner** con cámara o galería, arrastrar y soltar, previsualización, animación de análisis de ~2 s, tarjeta de resultado y botón para añadir al día.
- **Semáforo de rentabilidad**: gramos de proteína por cada 100 kcal.
  - `≥ 7 g` → **Excelente** (verde)
  - `4–7 g` → **Aceptable** (ámbar)
  - `< 4 g` → **Mejorable** (rojo)
- **Dashboard diario** con anillo de calorías, progreso de proteína/carbohidratos/grasas, estado del día, densidad proteica y registro cronológico de comidas con hora, tipo, macros y miniatura.
- **Navegación por días**: tira de 7 días, flechas anterior/siguiente y vuelta rápida a hoy. Los días pasados se conservan; el día actual empieza vacío de forma natural.
- **Objetivos configurables** (por defecto 3000 kcal y 150 g de proteína) con presets Volumen / Mantener / Definir.
- **Persistencia local** con `localStorage`, borrado con deshacer y exportación JSON.
- **Detalles de UX**: toasts accesibles, hoja inferior con focus trap, anuncios para lectores de pantalla, soporte de `prefers-reduced-motion`, sin desbordamiento horizontal desde 360 px.

## Cómo ejecutarlo

No necesita build ni dependencias. Desde la raíz del repositorio:

```bash
python -m http.server 4173
```

Abre `http://127.0.0.1:4173/`.

También puedes abrir `index.html` directamente (`file://`), aunque se recomienda un servidor local para que las fuentes y el historial del navegador se comporten de forma consistente.

## Estructura

```
.
├── index.html              # Shell, vistas, sprite SVG e inputs de archivo
├── assets/logo.svg         # Logo / favicon
├── css/
│   ├── tokens.css          # Paleta, tipografía, radios, sombras y layout
│   └── app.css             # Componentes, escáner, dashboard, hojas, toasts y responsive
├── js/
│   ├── utils.js            # Fechas locales, formato, animaciones, compresión de imágenes
│   ├── nutrition.js        # Sumas, densidad proteica, semáforo y estado del día
│   ├── storage.js          # Esquema, saneamiento y mutaciones de localStorage
│   ├── api.js              # Mock de análisis + contrato para una API real
│   ├── app.js              # Arranque, rutas por hash y navegación
│   └── ui/
│       ├── scanner.js      # Flujo de foto → análisis → resultado → alta
│       ├── dashboard.js    # Resumen, tira semanal e historial
│       ├── settings.js     # Objetivos, exportar y vaciar día
│       ├── sheet.js        # Hoja inferior accesible
│       └── toast.js        # Avisos con acción (deshacer, ver mi día)
├── vercel.json             # Configuración de despliegue estático y cabeceras
├── .gitattributes
├── .gitignore
└── README.md
```

Todos los módulos se exponen en `window.ML` y se cargan con scripts clásicos, sin bundler.

## Datos guardados

Clave: `macrolens:data:v1`

```json
{
  "version": 1,
  "goals": { "kcal": 3000, "protein": 150, "carbs": 340, "fat": 85 },
  "days": {
    "2026-10-29": [
      {
        "id": "uuid",
        "name": "Lentejas con chorizo",
        "kcal": 650,
        "protein": 35,
        "carbs": 73,
        "fat": 24,
        "addedAt": "2026-10-29T13:24:00.000Z",
        "thumb": "data:image/jpeg;base64,..."
      }
    ]
  }
}
```

- Las fechas se guardan como `YYYY-MM-DD` en **hora local**, no UTC, para que el día cambie a medianoche donde está el usuario.
- Las fotos se reducen a una miniatura JPEG de 380 px de lado máximo antes de guardarse. Aun así, `localStorage` tiene un límite de unos 5 MB por origen; si se llena, la app muestra un error y no pierde el estado anterior.
- El botón **Exportar copia** descarga el JSON completo. No hay cuentas ni sincronización en la nube.

## Conectar un análisis real

`js/api.js` separa el mock del resto de la interfaz:

```js
// Contrato de respuesta
{
  dish: "Lentejas con chorizo",
  calories: 650,
  protein: 35,
  carbs: 73,
  fat: 24,
  confidence: 0.93,
  portion: "1 plato mediano · ≈ 450 g",
  ingredients: ["Lentejas", "Chorizo", "Zanahoria"]
}
```

Para producción, envía la imagen a tu propio backend (`POST /api/analyze`) y devuelve ese contrato. `analyzeFoodImage(file)` ya implementa la llamada y `normalizeAnalysis()` tolera nombres alternativos (`name`, `kcal`, `carbohydrates`). Cambia la llamada de `ML.api.mockAnalyzeImage(file)` en `js/ui/scanner.js` por `ML.api.analyzeFoodImage(file)`.

> No incluyas claves de API en el navegador. La clave debe vivir en el servidor.

## Publicar en GitHub y Vercel

La app es 100 % estática: no hay build, variables de entorno ni backend. La raíz del repositorio **es** la app (no hay subcarpeta): `index.html`, `css/` y `js/` viven en el primer nivel.

### 1. Crear el repositorio en GitHub

Crea un repositorio vacío en GitHub (por ejemplo `macrolens`) y, desde esta carpeta:

```bash
cd macrolens
git init
git add .
git commit -m "feat: MacroLens nutrition tracker"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/macrolens.git
git push -u origin main
```

### 2. Desplegar en Vercel

**Desde la web:** en [vercel.com/new](https://vercel.com/new) importa el repositorio, elige el preset **Other**, deja el build command vacío y el output directory en `.` (o `./`). Pulsa **Deploy**.

**Desde la terminal:**

```bash
npm i -g vercel
cd macrolens
vercel
vercel --prod
```

Vercel detecta el `index.html` en la raíz y publica el sitio. `vercel.json` añade URLs limpias y cabeceras básicas de seguridad; no requiere configuración adicional.

Cada `git push` a `main` volverá a desplegar automáticamente si conectas el repositorio desde el panel de Vercel. El `localStorage` es por origen: los datos guardados en `localhost` no aparecen en el dominio de producción ni se comparten entre dispositivos.

## Notas de diseño

- Paleta semi-oscura (`#040a08`–`#0b1a15`), superficies glass con desenfoque y acento esmeralda `#3ee6a4`.
- Tipografía Sora para titulares e Inter para texto, con fallback a fuentes del sistema.
- Dos vistas principales (`#escaner` y `#dia`), navegación superior en escritorio y barra inferior fija en móvil.
- Estados del escáner: `idle → analyzing → ready → added`, con cancelación y reinicio.
- El semáforo del plato usa umbrales fijos; los objetivos solo mueven las barras del dashboard.

## Comprobado

- Flujo completo con foto real: análisis simulado, resultado, alta, persistencia tras recargar, eliminación con deshacer y vaciado del día con deshacer.
- Edición de objetivos y actualización inmediata del dashboard.
- Navegación a días anteriores y vuelta a hoy.
- 360×800, 390×844, 820×1180 y 1440×900 sin overflow horizontal ni errores de consola.
- CTAs del escáner visibles por encima de la barra inferior en móvil.
