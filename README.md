# LizMA - Framework de Automatizacion QA

Framework de pruebas automatizadas para **Crediclub Mujer Activa** usando Playwright en modo mobile (Pixel 7).

---

## Requisitos

- Node.js v18+
- npm
- Docker Desktop (opcional, para ejecucion aislada)

```bash
npm install
npx playwright install --with-deps
```

---

## Comandos principales

### Ejecutar tests

```bash
./run-test.sh                  # todos los tests
./run-test.sh @Login           # solo tests con tag @Login
./run-test.sh @smoke           # solo tests con tag @smoke
```

### Ejecutar con Docker

```bash
./run-test.sh --build          # construir imagen (solo la primera vez)
./run-test.sh --docker         # todos los tests en Docker
./run-test.sh --docker @Login  # solo un tag en Docker
```

### Comandos npm

```bash
npm test                       # todos los tests (Chromium + Firefox)
npm run test:chromium          # solo Chromium
npm run test:firefox           # solo Firefox
npm run test:run               # equivalente a ./run-test.sh
```

### Herramientas

```bash
npm run locator                # generador de locators (remoto)
npm run locator:local          # generador de locators (local)
```

### Reportes

```bash
npx playwright show-report     # abrir reporte HTML en el navegador
```

---

## Estructura del proyecto

```
LizMA/
├── tests/                     # Archivos .spec.ts
├── pages/                     # Page Objects
│   ├── base.page.ts           # Metodos base + Web Vitals + API Vitals
│   ├── login.page.ts          # Pagina de login
│   ├── menu.page.ts           # Pagina de menu
│   └── page.manager.ts        # Orquestador de pages
├── utils/
│   ├── test-base.ts           # Fixture: pm, makeStep
│   └── manifest-generator.js  # Genera manifiesto de pasos antes de cada ejecucion
├── automation/
│   ├── evidence-generator.ts  # Generador de PDF de evidencia
│   ├── agent/                 # Cliente Gemini AI
│   └── utils/                 # Template PDF, locator generator
├── config/                    # Configuraciones externas
├── playwright.config.ts       # Configuracion de Playwright
├── run-test.sh                # Script unico de ejecucion (local y Docker)
├── Dockerfile                 # Imagen Docker
└── docker-compose.yml         # Compose para Docker
```

---

## Como escribir un test

```typescript
import { test, MakeStepFn, PageManager } from "@utils/test-base";

test.describe('Mi Flujo @MiTag', () => {
    let pm: PageManager;
    let makeStep: MakeStepFn;

    test.beforeEach(async ({ pm: p, makeStep: ms }) => {
        pm = p;
        makeStep = ms;
    });

    test('Nombre del test', async () => {
        await makeStep('Navegar a pagina || Se cargo la pagina', async () => {
            await pm.loginPage.cargarPagina();
        });

        await makeStep('Ingresar datos || Se llenaron los campos', async () => {
            // tu codigo aqui
        });
    });
});
```

---

## Formato de pasos con ||

Cada `makeStep` usa el separador `||` para dividir **accion** y **resultado esperado**:

```
'Accion que se realiza || Resultado esperado'
```

En el PDF de evidencia:
- **Accion** se pinta en negro
- **Resultado** se pinta en verde (paso) o rojo (fallo)
- Pasos no ejecutados se pintan en gris

---

## Manifiesto automatico

El script `run-test.sh` genera un manifiesto temporal antes de ejecutar los tests. Esto permite que el PDF muestre TODOS los pasos planeados, incluso los que no se ejecutaron porque un paso anterior fallo.

Flujo interno:
1. Se escanean los `.spec.ts` y se extraen los `makeStep`
2. Se genera `test-results/manifest.json` (temporal)
3. Se corren los tests
4. Se genera el PDF con pasos ejecutados + pendientes
5. Se borra el manifiesto

---

## Evidencia PDF

Cada `makeStep` automaticamente:
- Toma screenshot
- Captura Web Vitals (LCP, CLS, FCP, TTFB, Load Time)
- Genera PDF corporativo en `target/Evidencias_PDF/`

Las evidencias se organizan por sesion, browser y status:
```
target/Evidencias_PDF/
└── Ejecucion_11-Apr_12-05-AM/
    └── chromium/
        └── Nombre_del_test/
            ├── PASADOS/
            └── FALLIDOS/
```

---

## Tags

Agrega tags en el nombre del `test.describe` para filtrar ejecuciones:

```typescript
test.describe('Checkout @smoke', () => { ... });
test.describe('Login @Login', () => { ... });
test.describe('Registro @regresion', () => { ... });
```

Ejecutar por tag:

```bash
./run-test.sh @smoke
```

---

## Variables de entorno

Crear archivo `.env` en la raiz:

```
GEMINI_API_KEY=tu_api_key_aqui
```

---

## CI/CD

El proyecto incluye un workflow de GitHub Actions (`.github/workflows/playwright.yml`) que ejecuta los tests automaticamente en push y pull request a `main`/`master`.
