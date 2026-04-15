import * as fs from 'fs-extra';
import * as path from 'path';

const MANIFEST_PATH = path.resolve('test-results/manifest.json');

export default async function globalTeardown() {
    if (fs.existsSync(MANIFEST_PATH)) {
        fs.removeSync(MANIFEST_PATH);
        console.log('🧹 Manifiesto limpiado');
    }
}
