#!/bin/bash

# ─── Uso ──────────────────────────────────────────────────────────────────────
# ./run-test.sh                → corre todos los tests
# ./run-test.sh @Login         → corre solo tests con tag @Login
# ./run-test.sh --headed       → corre con navegador visible
# ./run-test.sh --headed @Login→ navegador visible + tag
# ./run-test.sh --docker       → corre todos los tests en Docker
# ./run-test.sh --docker @Login→ corre tag @Login en Docker
# ./run-test.sh --build        → construye/reconstruye la imagen Docker

# ─── Parsear argumentos ──────────────────────────────────────────────────────
DOCKER=false
HEADED=false
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
        --headed)
            HEADED=true
            ;;
        *)
            TAG="$arg"
            ;;
    esac
done

# ─── Identidad de la ejecución ────────────────────────────────────────────────
export EJECUCION_ID="Ejecucion_$(date +%d-%b_%I-%M-%p)"

MODO=$($DOCKER && echo "Docker" || echo "Local")
$HEADED && MODO="$MODO | Headed"

echo "--------------------------------------------------------"
echo "🎭 PLAYWRIGHT RUNNER"
echo "🆔 Sesión: $EJECUCION_ID"
echo "🌐 Browser: Chromium | $MODO"
[ -n "$TAG" ] && echo "🏷️  Tag: $TAG"
echo "--------------------------------------------------------"

# ─── Construir comando ────────────────────────────────────────────────────────
CMD="npx playwright test --project=Mobile-Chromium"
[ -n "$TAG" ]   && CMD="$CMD --grep \"$TAG\""
$HEADED         && CMD="$CMD --headed"

# ─── Ejecutar tests ───────────────────────────────────────────────────────────
if $DOCKER; then
    docker compose run --rm tests $CMD
else
    eval $CMD
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
