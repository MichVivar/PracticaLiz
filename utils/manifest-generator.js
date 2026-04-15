const fs = require('fs');
const path = require('path');
const glob = require('path');

const testsDir = path.resolve(__dirname, '../tests');
const outputPath = path.resolve(__dirname, '../test-results/manifest.json');

const manifest = {};

function scanSpecFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const relPath = path.relative(path.resolve(__dirname, '..'), filePath);
    manifest[relPath] = {};

    let currentTest = null;

    for (const line of lines) {
        // Detectar test('...' o test("..."
        const testMatch = line.match(/test\s*\(\s*['"`]([^'"`]+)['"`]/);
        if (testMatch && !line.includes('test.describe') && !line.includes('test.beforeEach') && !line.includes('test.afterEach')) {
            currentTest = testMatch[1];
            manifest[relPath][currentTest] = [];
        }

        // Detectar makeStep('...' o makeStep("..."
        const stepMatch = line.match(/makeStep\s*\(\s*['"`]([^'"`]+)['"`]/);
        if (stepMatch && currentTest) {
            manifest[relPath][currentTest].push(stepMatch[1]);
        }
    }
}

// Escanear todos los .spec.ts en tests/
function scanDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            scanDir(fullPath);
        } else if (file.name.endsWith('.spec.ts')) {
            scanSpecFile(fullPath);
        }
    }
}

// Asegurar directorio de salida
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

scanDir(testsDir);

fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));
console.log('📋 Manifiesto generado:', outputPath);
console.log(JSON.stringify(manifest, null, 2));
