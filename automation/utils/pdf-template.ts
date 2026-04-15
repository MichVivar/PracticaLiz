import * as fs from 'fs-extra';

export interface PdfTemplateParams {
    testTitle: string;
    projectName: string;
    testStatus: string;
    date: string;
    timestamp: string;
    browserName: string;
    accentColor: string;
    browserColor: string;
    currentIcon: string;
    avgLoad: string;
    uxStatus: string;
    isPass: boolean;
    cycleId: string;
    plannedSteps: { title: string }[];
    executedSteps: { title: string; screenshotPath: string; apiInfo?: unknown; status: string; vitals?: { lcp: number | null; cls: number; fcp: number | null; ttfb: number | null; domContentLoaded: number; loadComplete: number } }[];
    validEvidenceSteps: { title: string; screenshotPath: string; apiInfo?: unknown; status: string; vitals?: { lcp: number | null; cls: number; fcp: number | null; ttfb: number | null; domContentLoaded: number; loadComplete: number } }[];
    hostType: string;
    infraType: string;
}

function formatStepTitle(title: string, status: 'passed' | 'failed' | 'pending'): string {
    const parts = title.split('||').map(p => p.trim());
    const accion = parts[0];
    const resultado = parts[1];

    if (!resultado) {
        const color = status === 'passed' ? '#222' : status === 'failed' ? '#EF4444' : '#B0B0B0';
        return `<span style="color: ${color};">${accion}</span>`;
    }

    const accionColor = status === 'pending' ? '#B0B0B0' : '#222';
    const resultadoColor = status === 'passed' ? '#10B981' : status === 'failed' ? '#EF4444' : '#B0B0B0';

    return `<span style="color: ${accionColor};">${accion}</span> <span style="color: #ccc;">||</span> <span style="color: ${resultadoColor}; font-weight: 700;">${resultado}</span>`;
}

export function buildPdfTemplate(p: PdfTemplateParams): string {
    const getVitalClass = (val: number) => val < 1.5 ? 'vital-good' : val < 3 ? 'vital-med' : 'vital-bad';

    const sourceSteps = p.plannedSteps?.length > 0 ? p.plannedSteps : p.executedSteps;

    const stepsHtml = sourceSteps.map((plannedStep, i) => {
        const execution = p.executedSteps.find(e => e.title === plannedStep.title);
        let icon = '⚪'; let pageInfo = 'PENDIENTE';
        let status: 'passed' | 'failed' | 'pending' = 'pending';

        if (execution) {
            if (execution.status === 'passed') {
                status = 'passed'; icon = '✅';
                const evIndex = p.validEvidenceSteps.findIndex(v => v.title === execution.title);
                pageInfo = evIndex !== -1 ? `Pag. ${evIndex + 2}` : 'OK';
            } else if (execution.status === 'failed') {
                status = 'failed'; icon = '❌'; pageInfo = 'ERROR';
            }
        }

        const numColor = status === 'passed' ? '#10B981' : status === 'failed' ? '#EF4444' : '#B0B0B0';

        return `
        <div class="step-item">
            <span style="color: ${numColor}; font-weight: 700;">${i + 1}.</span>
            <span class="step-text">${icon} ${formatStepTitle(plannedStep.title, status)}</span>
            <span style="flex-grow: 1; border-bottom: 1px dotted #ddd; margin: 0 4px;"></span>
            <span style="font-size: 9px; ${pageInfo === 'ERROR' ? 'color: #EF4444; font-weight: 700;' : 'color: #999;'}">${pageInfo}</span>
        </div>`;
    }).join('');

    const evidencePagesHtml = p.validEvidenceSteps.map((s, i) => {
        if (!fs.existsSync(s.screenshotPath)) return '';

        const stepStatus = (s.status === 'passed' || s.status === 'failed') ? s.status as 'passed' | 'failed' : 'pending' as const;

        const vitalsHtml = s.vitals ? `
            <div class="vitals-container">
                ${s.vitals.lcp !== null ? `<div class="vital-badge ${getVitalClass(s.vitals.lcp / 1000)}">📊 LCP: ${(s.vitals.lcp / 1000).toFixed(2)}s</div>` : ''}
                <div class="vital-badge ${s.vitals.cls < 0.1 ? 'vital-good' : s.vitals.cls < 0.25 ? 'vital-med' : 'vital-bad'}">📐 CLS: ${s.vitals.cls.toFixed(3)}</div>
                ${s.vitals.fcp !== null ? `<div class="vital-badge ${getVitalClass(s.vitals.fcp / 1000)}">🎨 FCP: ${(s.vitals.fcp / 1000).toFixed(2)}s</div>` : ''}
                ${s.vitals.ttfb !== null ? `<div class="vital-badge ${getVitalClass(s.vitals.ttfb / 1000)}">🖥️ TTFB: ${(s.vitals.ttfb / 1000).toFixed(2)}s</div>` : ''}
                <div class="vital-badge ${getVitalClass(s.vitals.loadComplete / 1000)}">⏱️ Load: ${(s.vitals.loadComplete / 1000).toFixed(2)}s</div>
            </div>` : '';

        const imgBase64 = fs.readFileSync(s.screenshotPath).toString('base64');
        return `
        <div class="step-page">
            <div class="step-header">
                <span style="color: ${p.accentColor}; font-weight: 700;">PASO ${i + 1}</span>
                <div class="step-title">${formatStepTitle(s.title, stepStatus)}</div>
                ${vitalsHtml}
            </div>
            <div class="screenshot-container" style="flex-grow: 1; display: flex; justify-content: center; align-items: center;">
                <img src="data:image/png;base64,${imgBase64}" class="screenshot-img">
            </div>
            ${s.apiInfo ? `<div style="background:#f8f9fa; padding:12px; border-radius:8px; font-size:10px; margin-top:15px; border-left:4px solid #4285F4;"><b>API Response:</b><pre>${JSON.stringify(s.apiInfo, null, 2)}</pre></div>` : ''}
            <div class="footer">TeonCred Automation | Sesión: ${p.cycleId} | Pagina ${i + 2}</div>
        </div>`;
    }).join('');

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;400;700&display=swap" rel="stylesheet">
        <style>
            @page { size: A4; margin: 0; }
            html, body { margin: 0; padding: 0; font-family: 'Roboto', sans-serif; font-weight: 300; color: #444; }
            b, strong { font-weight: 700; }
            .cover { height: 297mm; padding: 60px 50px; display: flex; flex-direction: column; box-sizing: border-box; page-break-after: always; }
            .status-banner { border-left: 10px solid ${p.accentColor}; padding: 20px; background: #fcfcfc; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .status-text { font-size: 38px; font-weight: 700; color: ${p.accentColor}; margin: 0; letter-spacing: -0.5px;}
            .perf-score { text-align: right; border-left: 1px solid #eee; padding-left: 20px; }
            .steps-grid { display: block; column-count: ${p.plannedSteps.length > 12 ? 2 : 1}; column-gap: 30px; margin-top: 15px; min-height: 100px; }
            .step-item { display: flex; align-items: baseline; gap: 8px; font-size: 11px; margin-bottom: 6px; break-inside: avoid; }
            .step-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 320px; }
            .tech-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 25px 0; }
            .tech-item { display: flex; align-items: center; font-size: 14px; color: #555; gap: 10px; }
            .step-page { height: 297mm; padding: 40px; box-sizing: border-box; display: flex; flex-direction: column; page-break-after: always; position: relative; background-color: #ffffff !important; }
            .step-header { border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
            .step-title { font-size: 18px; font-weight: 700; color: #222; }
            .screenshot-img { max-height: 67vh; width: auto; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); display: block; margin: auto; }
            .footer { position: absolute; bottom: 20px; left: 40px; font-size: 10px; color: #aaa; }
            .vitals-container { display: flex; gap: 10px; margin-top: 5px; }
            .vital-badge { font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 700; display: flex; align-items: center; gap: 4px; border: 1px solid rgba(0,0,0,0.05); }
            .vital-good { background: #ECFDF5; color: #065F46; }
            .vital-med { background: #FFFBEB; color: #92400E; }
            .vital-bad { background: #FEF2F2; color: #991B1B; }
        </style>
    </head>
    <body>
        <div class="cover">
            <div style="display: flex; align-items: center; gap: 10px; font-size: 11px; color: ${p.browserColor}; font-weight: 700; margin-bottom: 20px; letter-spacing: 2.5px;">
                ${p.currentIcon}
                <span><b>${p.browserName.toUpperCase()} AUTOMATION SESSION</b></span>
            </div>
            <div class="status-banner">
                <div>
                    <p style="font-size: 14px; color: #888; margin-bottom: 5px;">RESULTADO GLOBAL</p>
                    <h1 class="status-text">${p.isPass ? 'PASADO' : 'FALLIDO'}</h1>
                </div>
                <div class="perf-score">
                    <p style="font-size: 12px; color: #888; margin-bottom: 2px;">AVG LOAD TIME</p>
                    <p style="font-size: 24px; font-weight: 700; color: #444; margin: 0;">${p.avgLoad}s</p>
                </div>
            </div>
            <div class="tech-grid">
                <div class="tech-item">🐳 <b>Infra:</b> ${p.infraType}</div>
                <div class="tech-item">☁️ <b>Host:</b> ${p.hostType}</div>
                <div class="tech-item">🎭 <b>Engine:</b> Playwright Framework</div>
                <div class="tech-item">⏱️ <b>UX Status:</b> ${p.uxStatus}</div>
                <div class="tech-item">📱 <b>Device:</b> ${p.projectName}</div>
            </div>
            <div style="margin: 30px 0;">
                <p style="font-weight: 700; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 15px; font-size: 14px;">ESCENARIO DE PRUEBA:</p>
                <p style="font-size: 18px; color: #222; font-weight: 400; margin-bottom: 10px;">${p.testTitle}</p>
                <p style="font-size: 11px; color: #888; margin-top: 15px;"><b>Fecha:</b> ${p.date} | ${p.timestamp}</p>
            </div>
            <div style="margin-top: 10px;">
                <p style="font-weight: 700; color: #555; border-bottom: 2px solid #eee; padding-bottom: 8px; font-size: 13px;">🔍 FLUJO DE VALIDACIÓN</p>
                <div class="steps-grid">${stepsHtml}</div>
            </div>
            <div style="margin-top: auto; padding: 20px; border-top: 1px dashed #ddd; font-size: 9px; color: #999; text-align: center; font-style: italic;">
                Documento generado automáticamente por el Framework de QA de TeonCred mediante ejecución aislada en contenedores Docker.
            </div>
        </div>
        ${evidencePagesHtml}
    </body>
    </html>`;
}