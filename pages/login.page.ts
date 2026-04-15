import { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

export class LoginPage extends BasePage {

    private readonly usernameInput: Locator;
    private readonly passwordInput: Locator;
    private readonly loginButton: Locator;

    constructor (page: Page) {
        super(page);
        this.usernameInput = page.getByRole('textbox', { name: 'Usuario', exact: true });
        this.passwordInput = page.getByRole('textbox', { name: 'Contraseña', exact: true });
        this.loginButton = page.getByRole('button', { name: 'Iniciar sesión', exact: true });
    }

    //Método para cargar la página de Login
    async cargarPagina() {
        await this.navegarA('/loginmanual');
        await this.usernameInput.waitFor({ state: 'visible' });
    }
}