const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.jpeg') || filePath.endsWith('.jpg')) return 'image/jpeg';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  return 'application/octet-stream';
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(root, safePath === path.sep || safePath === '/' ? 'index.html' : safePath);

    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

const firebaseStub = `
window.firebase = {
  initializeApp: function () {},
  auth: function () {
    return {
      currentUser: null,
      onAuthStateChanged: function (callback) {
        setTimeout(function () { callback(null); }, 0);
        return function () {};
      },
      signInWithEmailAndPassword: async function () { throw new Error('Auth deshabilitado'); },
      signOut: async function () {}
    };
  },
  firestore: function () {
    const snapshots = {
      asignaciones: { 
        docs: [{ id: '2026-05-02', data: () => ({ date_key: '2026-05-02', mentor_nombre: 'Mentora Test' }) }] 
      },
      mentores: { docs: [{ id: 'm1', data: () => ({ nombre: 'Mentor Test' }) }] }
    };
    window.__firestoreCalls = [];
    const makeDocApi = (collName, id) => ({
      id: id || 'doc-id',
      get: async () => ({
        exists: false,
        data: () => ({})
      }),
      set: async (data) => {
        window.__firestoreCalls.push({ type: 'set', collection: collName, id, data });
      }
    });
    const makeCollectionApi = (name) => ({
      get: async () => snapshots[name] || { docs: [] },
      doc: (id) => makeDocApi(name, id)
    });
    return {
      enablePersistence: async () => {},
      collection: (name) => {
        window.__firestoreCalls.push({ type: 'collection', name });
        return makeCollectionApi(name);
      },
      runTransaction: async (callback) => {
        window.__firestoreCalls.push({ type: 'transaction' });
        return callback({
          get: async (docRef) => docRef.get(),
          set: (docRef, data) => docRef.set(data)
        });
      }
    };
  }
};
window.firebase.firestore.FieldValue = { serverTimestamp: () => 'SERVER_TIMESTAMP' };
`;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  if (!fs.existsSync(indexPath)) throw new Error('No existe index.html.');

  const { server, url } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  const dialogs = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const ignored = [
      'Failed to load resource',
      'net::ERR_ABORTED',
      'cdn.tailwindcss.com should not be used in production'
    ];
    if (!ignored.some((pattern) => text.includes(pattern))) consoleErrors.push(text);
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });

  await page.addInitScript(() => {
    window.__printCalled = 0;
    window.__clipboardWrites = [];
    window.__downloadClicks = 0;
    window.__objectUrls = [];

    window.print = () => {
      window.__printCalled += 1;
    };

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.__clipboardWrites.push(text);
        }
      }
    });
  });

  await page.route('**/*', async (route) => {
    const requestUrl = route.request().url();
    if (requestUrl.includes('gstatic.com/firebasejs')) {
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: firebaseStub });
      return;
    }
    if (
      requestUrl.includes('cdn.tailwindcss.com') ||
      requestUrl.includes('cdnjs.cloudflare.com') ||
      requestUrl.includes('fonts.googleapis.com') ||
      requestUrl.includes('fonts.gstatic.com')
    ) {
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: '' });
      return;
    }
    await route.continue();
  });

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#meses-container button', { timeout: 7000 });
    await page.waitForSelector('#grid-web > div', { timeout: 7000 });
    await page.waitForSelector('#month-summary-kpis [data-kpi]', { timeout: 7000 });

    let kpis = await page.evaluate(() => [...document.querySelectorAll('#month-summary-kpis [data-kpi]')].map((card) => ({
      key: card.dataset.kpi,
      value: card.querySelector('.kpi-value')?.textContent.trim()
    })));
    assert(kpis.length === 4, 'No aparecen las 4 tarjetas KPI.');
    assert(kpis.every((card) => card.value !== ''), 'Alguna tarjeta KPI no muestra numero.');

    await page.getByRole('button', { name: 'Abril' }).click();
    await page.waitForFunction(() => document.getElementById('titulo-mes-actual')?.textContent.trim() === 'Abril');
    kpis = await page.evaluate(() => [...document.querySelectorAll('#month-summary-kpis [data-kpi]')].map((card) => card.dataset.kpi));
    assert(kpis.length === 4, 'Las tarjetas KPI no siguen presentes al cambiar de mes.');
    const holidayText = await page.evaluate(() => document.getElementById('grid-web').textContent);
    assert(holidayText.includes('Jueves Santo') || holidayText.includes('Viernes Santo'), 'Los festivos no muestran explicacion visible.');

    const imageUi = await page.evaluate(() => ({
      hasDesktopMenu: !!document.getElementById('menu-image-desktop'),
      hasMobileSheet: !!document.getElementById('image-sheet-backdrop'),
      desktopExpanded: document.getElementById('btn-image-desktop').hasAttribute('aria-expanded'),
      desktopAction: document.getElementById('btn-image-desktop').getAttribute('onclick'),
      mobileAction: document.getElementById('btn-image-mobile').getAttribute('onclick'),
      visibleOptions: document.body.textContent.includes('Imagen Disponibilidad') || document.body.textContent.includes('Imagen Asignados')
    }));
    assert(!imageUi.hasDesktopMenu, 'El menu desktop de Imagen sigue presente.');
    assert(!imageUi.hasMobileSheet, 'El bottom sheet movil de Imagen sigue presente.');
    assert(!imageUi.desktopExpanded, 'El boton Imagen conserva aria-expanded aunque ya no despliega menu.');
    assert(imageUi.desktopAction.includes("descargarImagen('asignados')"), 'El boton Imagen desktop no apunta a asignados.');
    assert(imageUi.mobileAction.includes("descargarImagen('asignados')"), 'El boton Imagen movil no apunta a asignados.');
    assert(!imageUi.visibleOptions, 'Siguen visibles opciones de Imagen Disponibilidad/Asignados.');

    await page.click('#btn-login-admin');
    let loginHidden = await page.$eval('#modal-login', (el) => el.classList.contains('hidden'));
    assert(!loginHidden, 'El modal Admin/Login no se abrio.');
    await page.keyboard.press('Escape');
    loginHidden = await page.$eval('#modal-login', (el) => el.classList.contains('hidden'));
    assert(loginHidden, 'El modal Admin/Login no se cerro con Escape.');

    await page.click('button[onclick="window.print()"]');
    const printCalled = await page.evaluate(() => window.__printCalled);
    assert(printCalled === 1, 'window.print no fue llamado por el boton PDF.');

    await page.click('button[onclick="copiarParaWhatsapp()"]');
    await page.waitForFunction(() => window.__clipboardWrites.length > 0, { timeout: 3000 });
    const clipboardText = await page.evaluate(() => window.__clipboardWrites[0]);
    assert(clipboardText.includes('PROGRAMACI'), 'WhatsApp no genero texto de programacion.');
    assert(clipboardText.includes('Mentes Brillantes'), 'WhatsApp no incluyo la identidad institucional.');

    await page.evaluate(() => {
      window.URL.createObjectURL = (blob) => {
        const url = `blob:interactions-${window.__objectUrls.length + 1}`;
        window.__objectUrls.push({ url, type: blob && blob.type });
        return url;
      };
      window.URL.revokeObjectURL = () => {};
      window.HTMLAnchorElement.prototype.click = function () {
        if (this.download && this.href) window.__downloadClicks += 1;
      };
      window.html2canvas = async () => ({
        toBlob(callback) {
          callback(new Blob(['mock-image'], { type: 'image/png' }));
        }
      });
    });
    await page.click('#btn-image-desktop');
    await page.waitForFunction(() => window.__downloadClicks > 0, { timeout: 3000 });

    const flyer = await page.evaluate(() => ({
      header: document.querySelector('#capture-target .flyer-title')?.textContent.trim() || '',
      logoSrc: document.querySelector('#capture-target .flyer-logo-img')?.getAttribute('src') || '',
      month: document.getElementById('flyer-month')?.textContent.trim() || '',
      summaryCards: document.querySelectorAll('#flyer-summary [data-flyer-kpi]').length,
      rows: document.querySelectorAll('#flyer-list .flyer-row').length,
      statuses: [...document.querySelectorAll('#flyer-list .flyer-status')].map((el) => el.textContent.trim()),
      downloads: window.__downloadClicks
    }));
    assert(flyer.header.includes('Mentes Brillantes'), 'El flyer no conserva encabezado institucional.');
    assert(flyer.logoSrc.includes('dorado'), 'El flyer no usa el logo dorado institucional.');
    assert(flyer.month.length > 0, 'El flyer no tiene mes.');
    assert(flyer.summaryCards === 4, 'El flyer no genero el resumen KPI compacto.');
    assert(flyer.rows > 0, 'El flyer no genero filas.');
    assert(flyer.statuses.some((text) => text.includes('Mentora Test') || text.includes('Sin asignar')), 'El flyer no corresponde al modo asignados.');
    assert(flyer.downloads === 1, 'El flujo de imagen no llego al paso de descarga simulado.');

    // TEST: FLUJO APARTAR (Detectar nombres de colecciones incorrectos)
    await page.evaluate(() => {
        const grid = document.getElementById('grid-web');
        // Buscar el botón que diga "Apartar"
        const availableBtn = [...grid.querySelectorAll('button')].find(b => b.textContent === 'Apartar');
        if (availableBtn) {
            availableBtn.click();
            window.__clickedApartar = true;
        } else {
            window.__clickedApartar = false;
        }
    });
    
    const clicked = await page.evaluate(() => window.__clickedApartar);
    assert(clicked, 'No se encontro boton de "Apartar" en los dias disponibles.');

    const modalVisible = await page.isVisible('#modal-apartar');
    assert(modalVisible, 'El modal de apartar no se mostro despues de click.');
    
    // Esperar a que el select tenga mas de la opcion por defecto
    await page.waitForFunction(() => document.querySelectorAll('#apartar-nombre option').length > 1, { timeout: 5000 });
    
    await page.selectOption('#apartar-nombre', { index: 1 });
    await page.click('button[onclick="confirmarApartado(this)"]');
    
    // Esperar a que la transacción termine en el mock
    await page.waitForFunction(() => window.__firestoreCalls.some(c => c.type === 'transaction'), { timeout: 5000 });
    
    const firestoreCalls = await page.evaluate(() => window.__firestoreCalls);
    const collectionsTargeted = firestoreCalls.filter(c => c.type === 'collection').map(c => c.name);
    
    // Verificamos que NO use snake_case
    assert(!collectionsTargeted.includes('solicitudes_publicas'), 'ERROR: Se detecto uso de solicitudes_publicas (snake_case) incorrecto.');
    assert(!collectionsTargeted.includes('solicitudes_apartado'), 'ERROR: Se detecto uso de solicitudes_apartado (snake_case) incorrecto.');
    
    // Verificamos que USE camelCase
    assert(collectionsTargeted.includes('solicitudesPublicas'), 'Falta llamar a solicitudesPublicas.');
    assert(collectionsTargeted.includes('solicitudesApartado'), 'Falta llamar a solicitudesApartado.');
    assert(collectionsTargeted.includes('asignaciones'), 'Falta validar disponibilidad en asignaciones.');

    if (consoleErrors.length > 0) throw new Error(`Errores reales de consola: ${consoleErrors.join(' | ')}`);
    console.log('OK: interacciones, transacciones y nombres de colecciones Firestore validados.');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
