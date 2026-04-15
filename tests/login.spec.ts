import { test, MakeStepFn, PageManager } from "@utils/test-base";

test.describe('Login Tests @Login', () => {
    let pm: PageManager;
    let makeStep: MakeStepFn;

    test.beforeEach(async ({ pm: p, makeStep: ms }) => {
        pm = p;
        makeStep = ms;
    });

    test('Login a MA', async () => {
        await makeStep('Navegar a pagina || Se entro a la pagina', async () => {
            await pm.loginPage.cargarPagina();
        })
    });

    test('Login a MA Fallo', async () => {
        await makeStep('Navegar a pagina || Se entro a la pagina', async () => {
            await pm.loginPage.cargarPagina();
        })
        await makeStep('Validar asesor || Se valido asesor', async () => {
            await pm.menuPage.validarAsesor();
        })
        await makeStep('Clic en menu || Se entro a menu', async () => {
            await pm.menuPage.validarAsesor();
        })
        await makeStep('Se agrega nombre || Se agrego nombre', async () => {
            await pm.menuPage.validarAsesor();
        })
    });
});