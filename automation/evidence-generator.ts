import * as fs from 'fs-extra';
import * as path from 'path';
import dayjs from 'dayjs';
import { chromium } from '@playwright/test';
import { buildPdfTemplate } from './utils/pdf-template';

const CICLO_UNICO = process.env.EJECUCION_ID || dayjs().format('[Ejecucion]_DD-MMM_hh-mm-a');

export async function generateCorporatePDF(
    testInfo: any,
    plannedSteps: { title: string }[],
    executedSteps: { title: string; screenshotPath: string; apiInfo?: any; status: string; vitals?: any }[],
    browserNameParam?: string
) {
    const date = dayjs().format('DD/MM/YYYY');
    const timestamp = dayjs().format('HH:mm:ss');

    const browserName = (browserNameParam || process.env.BROWSER || 'chromium').toLowerCase();
    const isPass = testInfo.status === 'passed';
    const accentColor = isPass ? '#10B981' : '#EF4444';
    const browserColor = browserName.includes('chromium') ? '#4285F4'
        : browserName.includes('firefox') ? '#FF7139'
        : '#8E8E93';

    // Promedio de performance global
    const vitalsOnly = executedSteps.filter(s => s.vitals).map(s => s.vitals.loadComplete / 1000);
    const avgLoad = vitalsOnly.length > 0
        ? (vitalsOnly.reduce((a: number, b: number) => a + b, 0) / vitalsOnly.length).toFixed(2)
        : '0.00';

    const browserIcons: Record<string, string> = {
        chromium: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${browserColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg>`,
        firefox:  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${browserColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        webkit:   `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${browserColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>`
    };

    const currentIcon = browserName.includes('firefox') ? browserIcons.firefox
        : browserName.includes('chrome') || browserName.includes('chromium') ? browserIcons.chromium
        : browserIcons.webkit;

    const cycleFolder = path.join('./target/Evidencias_PDF', CICLO_UNICO, browserName);
    const scenarioName = testInfo.title.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
    const statusFolder = isPass ? 'PASADOS' : 'FALLIDOS';
    const finalPath = path.join(cycleFolder, scenarioName, statusFolder);

    await fs.ensureDir(finalPath);

    const validEvidenceSteps = executedSteps.filter(s => s.screenshotPath && s.screenshotPath !== '');

    const isCI = process.env.CI || process.env.DOCKER_ENV;
    const hostType = isCI ? 'Remote Virtual Machine (MV)' : 'Local Development Workstation';
    const infraType = isCI ? 'Docker Container Runtime' : 'Node.js Native Runtime';

    const nAvg = Number(avgLoad);
    const uxStatus = nAvg < 1.5 ? '🟢 Óptimo' : nAvg < 3.0 ? '🟡 Regular' : '🔴 Lento / Crítico';

    const htmlContent = buildPdfTemplate({
        testTitle: testInfo.title,
        projectName: testInfo.project.name,
        testStatus: testInfo.status,
        date,
        timestamp,
        browserName,
        accentColor,
        browserColor,
        currentIcon,
        avgLoad,
        uxStatus,
        isPass,
        cycleId: CICLO_UNICO,
        plannedSteps,
        executedSteps,
        validEvidenceSteps,
        hostType,
        infraType,
    });

    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'load' });

    await page.pdf({
        path: path.join(finalPath, `EVIDENCIA_${scenarioName}.pdf`),
        format: 'A4',
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 }
    });

    await browser.close();

    executedSteps.forEach(s => {
        if (s.screenshotPath && fs.existsSync(s.screenshotPath)) {
            fs.removeSync(s.screenshotPath);
        }
    });
}