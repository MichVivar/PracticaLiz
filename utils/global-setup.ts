import * as fs from 'fs-extra';
import * as path from 'path';

const MANIFEST_PATH = path.resolve('test-results/manifest.json');

export default async function globalSetup() {
    const testsDir = path.resolve('tests');
    const manifest: Record<string, Record<string, string[]>> = {};

    function scanFile(filePath: string) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const relPath = path.relative(process.cwd(), filePath);

        manifest[relPath] = {};
        let currentTest: string | null = null;

        for (const line of lines) {
            const testMatch = line.match(/test\s*\(\s*['"`]([^'"`]+)['"`]/);
            if (testMatch && !line.includes('test.describe') && !line.includes('test.beforeEach') && !line.includes('test.afterEach')) {
                currentTest = testMatch[1];
                manifest[relPath][currentTest] = [];
            }

            const stepMatch = line.match(/makeStep\s*\(\s*['"`]([^'"`]+)['"`]/);
            if (stepMatch && currentTest) {
                manifest[relPath][currentTest].push(stepMatch[1]);
            }
        }
    }

    function scanDir(dir: string) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
            const fullPath = path.join(dir, file.name);
            if (file.isDirectory()) {
                scanDir(fullPath);
            } else if (file.name.endsWith('.spec.ts')) {
                scanFile(fullPath);
            }
        }
    }

    fs.ensureDirSync(path.dirname(MANIFEST_PATH));
    scanDir(testsDir);
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log('📋 Manifiesto generado');
}
