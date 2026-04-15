#!/bin/bash

# ─── Uso ──────────────────────────────────────────────────────────────────────
# ./run-test.sh                → corre todos los tests
# ./run-test.sh @Login         → corre solo tests con tag @Login
# ./run-test.sh --docker       → corre todos los tests en Docker
# ./run-test.sh --docker @Login→ corre tag @Login en Docker
# ./run-test.sh --build        → construye/reconstruye la imagen Docker

# ─── Parsear argumentos ──────────────────────────────────────────────────────
DOCKER=false
TAG=""

for arg in "$@"; do
    case "$arg" in
        --build)
            echo "🐳 Construyendo imagen..."
            docker compose build
            exit $?
            ;;
        --docker)
            DOCKER=true
            ;;
        *)
            TAG="$arg"
            ;;
    esac
done

# ─── Identidad de la ejecución ────────────────────────────────────────────────
export EJECUCION_ID="Ejecucion_$(date +%d-%b_%I-%M-%p)"

MODO=$($DOCKER && echo "Docker" || echo "Local")

echo "--------------------------------------------------------"
echo "🎭 PLAYWRIGHT RUNNER"
echo "🆔 Sesión: $EJECUCION_ID"
echo "🌐 Browser: Chromium | $MODO"
[ -n "$TAG" ] && echo "🏷️  Tag: $TAG"
echo "--------------------------------------------------------"

# ─── Ejecutar tests ───────────────────────────────────────────────────────────
if $DOCKER; then
    if [ -n "$TAG" ]; then
        docker compose run --rm tests npx playwright test --project=Mobile-Chromium --grep "$TAG"
    else
        docker compose run --rm tests npx playwright test --project=Mobile-Chromium
    fi
else
    if [ -n "$TAG" ]; then
        npx playwright test --project=Mobile-Chromium --grep "$TAG"
    else
        npx playwright test --project=Mobile-Chromium
    fi
fi

STATUS=$?

# ─── Resultado ────────────────────────────────────────────────────────────────
echo "--------------------------------------------------------"
if [ $STATUS -eq 0 ]; then
    echo "✅ TODOS LOS TESTS PASARON"
else
    echo "❌ HUBO FALLOS — revisa target/Evidencias_PDF"
fi
echo "--------------------------------------------------------"

exit $STATUS
