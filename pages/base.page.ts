import { Page, Locator, expect, APIRequestContext } from '@playwright/test';

export interface WebVitals {
    lcp: number | null;
    cls: number;
    fcp: number | null;
    ttfb: number | null;
    domContentLoaded: number;
    loadComplete: number;
}

export interface ApiVitals {
    url: string;
    method: string;
    status: number;
    duracion: number;
    ok: boolean;
}

export class BasePage {
    protected readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // Método para escribir
    async escribir(locator: Locator, texto: string){
        await locator.fill(texto);
    }

    // Método para hacer click
    async clickear(locator: Locator){
        await locator.click();
    }

    // Método para validar visibilidad
    async validarVisible(locator: Locator){
        await expect(locator).toBeVisible({timeout: 5000});
    }

    // Método para obtener texto
    async obtenerTexto(locator: Locator): Promise<string> {
        return await locator.innerText();
    }

    // Método para Selects (Listas desplegables)
    async seleccionarOpcion(locator: Locator, valor: string){
        await locator.selectOption(valor);
    }

    // Método para navegar a una URL
    async navegarA(url: string) {
        await this.page.goto(url);
        await this.page.waitForLoadState('networkidle');
    }

    // ─── Web Vitals ──────────────────────────────────────────────────────────
    async obtenerVitals(): Promise<WebVitals> {
        return await this.page.evaluate(() => {
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
    }

    validarVitals(vitals: WebVitals) {
        const resultados: string[] = [];
        const estado = (ok: boolean) => ok ? 'PASS' : 'FAIL';

        if (vitals.lcp !== null) {
            const ok = vitals.lcp < 2500;
            resultados.push(`  LCP: ${vitals.lcp.toFixed(0)}ms [${estado(ok)}] (< 2500ms)`);
        }

        resultados.push(`  CLS: ${vitals.cls.toFixed(3)} [${estado(vitals.cls < 0.1)}] (< 0.1)`);

        if (vitals.fcp !== null) {
            const ok = vitals.fcp < 1800;
            resultados.push(`  FCP: ${vitals.fcp.toFixed(0)}ms [${estado(ok)}] (< 1800ms)`);
        }

        if (vitals.ttfb !== null) {
            const ok = vitals.ttfb < 800;
            resultados.push(`  TTFB: ${vitals.ttfb.toFixed(0)}ms [${estado(ok)}] (< 800ms)`);
        }

        resultados.push(`  DOM Loaded: ${vitals.domContentLoaded.toFixed(0)}ms`);
        resultados.push(`  Full Load: ${vitals.loadComplete.toFixed(0)}ms`);

        console.log(`\n📊 Web Vitals:\n${resultados.join('\n')}`);
        return vitals;
    }

    // ─── API Vitals ──────────────────────────────────────────────────────────
    static async medirApi(
        request: APIRequestContext,
        method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
        url: string,
        options?: { data?: any; headers?: Record<string, string> }
    ): Promise<{ response: any; vitals: ApiVitals }> {
        const inicio = Date.now();
        const response = await request[method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch'](url, options);
        const duracion = Date.now() - inicio;

        const vitals: ApiVitals = {
            url,
            method,
            status: response.status(),
            duracion,
            ok: response.ok(),
        };

        const estado = vitals.ok ? 'PASS' : 'FAIL';
        console.log(`\n📡 API Vitals: ${method} ${url}`);
        console.log(`  Status: ${vitals.status} [${estado}]`);
        console.log(`  Duración: ${vitals.duracion}ms [${vitals.duracion < 3000 ? 'PASS' : 'FAIL'}] (< 3000ms)`);

        return { response, vitals };
    }
}