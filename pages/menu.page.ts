import { Locator, Page, expect } from '@playwright/test';
import { BasePage } from './base.page';

export class MenuPage extends BasePage {
    
    private readonly titleMenu: Locator;

    constructor(page: Page) {
        super(page);
        this.titleMenu = page.getByText('¿Qué deseas hacer el día de hoy?', { exact: true });
    }

    async validarAsesor (nombreEsperado: string = "Valerio Trujano"){
        await this.validarVisible(this.titleMenu)
        await expect(this.titleMenu).toHaveText(nombreEsperado);
    }
}