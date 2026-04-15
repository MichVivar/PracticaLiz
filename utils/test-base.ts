import { test as base, expect } from '@playwright/test';
import { PageManager } from '../pages/page.manager';
export type { PageManager };
import type { WebVitals } from '../pages/base.page';
import { generateCorporatePDF } from '../automation/evidence-generator';
import * as fs from 'fs-extra';
import * as path from 'path';

interface StepEvidence {
    title: string;
    screenshotPath: string;
    apiInfo: any;
    status: 'pending' | 'passed' | 'failed';
    vitals?: WebVitals;
}

export type MakeStepFn = (title: string, task: () => Promise<any>, apiData?: any) => Promise<void>;

export interface MyFixtures {
    pm: PageManager;
    makeStep: MakeStepFn;
}

export const test = base.extend<MyFixtures>({
    pm: async ({ page }, use) => { await use(new PageManager(page)); },
    makeStep: async ({ page }, use, testInfo) => {
        const stepsEvidences: StepEvidence[] = [];

        const makeStep = async (title: string, task: () => Promise<any>, apiData?: any) => {
            const stepEntry: StepEvidence = {
                title,
                screenshotPath: '',
                apiInfo: apiData,
                status: 'pending'
            };
            stepsEvidences.push(stepEntry);

            await base.step(title, async () => {
                try {
                    const result = await task();

                    if (result && !stepEntry.apiInfo) {
                        stepEntry.apiInfo = result;
                    }
                    stepEntry.status = 'passed';

                    if (!page.isClosed() && page.url() !== 'about:blank') {
                        await fs.ensureDir('test-results');
                        const cleanTitle = title.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
                        const ssPath = path.join('test-results', `ss_${Date.now()}_${cleanTitle}.png`);
                        await page.screenshot({ path: ssPath });
                        stepEntry.screenshotPath = ssPath;

                        // Capturar Web Vitals del paso (un solo roundtrip)
                        try {
                            stepEntry.vitals = await page.evaluate(() => {
                                const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
                                const paint = performance.getEntriesByType('paint');
                                const fcp = paint.find(e => e.name === 'first-contentful-paint');
                                const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
                                const lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : null;

                                return {
                                    lcp,
                                    cls: 0,
                                    fcp: fcp ? fcp.startTime : null,
                                    ttfb: nav ? nav.responseStart - nav.requestStart : null,
                                    domContentLoaded: nav ? nav.domContentLoadedEventEnd - nav.startTime : 0,
                                    loadComplete: nav ? nav.loadEventEnd - nav.startTime : 0,
                                };
                            });
                        } catch { /* vitals no disponibles */ }
                    }
                } catch (error) {
                    stepEntry.status = 'failed';

                    if (!page.isClosed() && page.url() !== 'about:blank') {
                        const cleanTitle = title.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
                        const ssPath = path.join('test-results', `ss_FAILED_${Date.now()}_${cleanTitle}.png`);
                        await page.screenshot({ path: ssPath });
                        stepEntry.screenshotPath = ssPath;
                    }
                    throw error;
                }
            });
        };

        await use(makeStep);

        try {
            // Leer manifiesto para obtener TODOS los pasos planeados
            const manifestPath = path.resolve('test-results/manifest.json');
            let plannedSteps: { title: string }[] = stepsEvidences.map(s => ({ title: s.title }));

            if (fs.existsSync(manifestPath)) {
                const manifest = fs.readJsonSync(manifestPath);
                const relFile = path.relative(process.cwd(), testInfo.file);
                const testTitle = testInfo.title;

                if (manifest[relFile] && manifest[relFile][testTitle]) {
                    plannedSteps = manifest[relFile][testTitle].map((t: string) => ({ title: t }));
                }
            }

            if (plannedSteps.length > 0) {
                await generateCorporatePDF(
                    testInfo,
                    plannedSteps,
                    stepsEvidences,
                    testInfo.project.name || process.env.BROWSER || 'chromium'
                );
            }
        } catch (pdfError) {
            console.error('❌ Error fatal generando el PDF de evidencia:', pdfError);
        }
    }
});

export { expect };