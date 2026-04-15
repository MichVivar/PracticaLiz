import { Page } from '@playwright/test';
import { LoginPage } from './login.page';
import { MenuPage } from './menu.page';

export class PageManager {
    private readonly page: Page;
    private readonly _loginPage: LoginPage;
    private readonly _menuPage: MenuPage;

    constructor(page: Page) {
        this.page = page;
        this._loginPage = new LoginPage(page);
        this._menuPage = new MenuPage(page);
    }

    get loginPage() {
        return this._loginPage;
    }

    get menuPage() {
        return this._menuPage;
    }
}