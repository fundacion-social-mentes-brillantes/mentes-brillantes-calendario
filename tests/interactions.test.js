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
      signInWithEmailAndPassword: async function () { throw new Error('Auth deshabilitado en interactions test'); },
      signOut: async function () {}
    };
  },
  firestore: function () {
    const emptySnapshot = { docs: [] };
    const collectionApi = {
      get: async function () { return emptySnapshot; },
      doc: function (id) {
        return { id: id || 'interactions-doc', data: function () { return {}; } };
      }
    };
    return {
      enablePersistence: function () { return Promise.resolve(); },
      collection: function () { return collectionApi; },
      batch: function () {
        return {
          set: function () { throw new Error('Escritura bloqueada en interactions test'); },
          delete: function () { throw new Error('Borrado bloqueado en interactions test'); },
          commit: async function () { throw new Error('Commit bloqueado en interactions test'); }
        };
      }
    };
  }
};
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

    await page.click('#btn-image-desktop');
    let imageMenu = await page.evaluate(() => ({
      expanded: document.getElementById('btn-image-desktop').getAttribute('aria-expanded'),
      hidden: document.getElementById('menu-image-desktop').classList.contains('hidden'),
      options: [...document.querySelectorAll('#menu-image-desktop [data-image-action]')].map((button) => button.textContent.trim())
    }));
    assert(imageMenu.expanded === 'true', 'El menu Imagen no marco aria-expanded=true.');
    assert(!imageMenu.hidden, 'El menu Imagen no se abrio.');
    assert(imageMenu.options.some((text) => text.includes('Disponibilidad')), 'No aparece la opcion Imagen Disponibilidad.');
    assert(imageMenu.options.some((text) => text.includes('Asignados')), 'No aparece la opcion Imagen Asignados.');

    await page.mouse.click(5, 5);
    imageMenu = await page.evaluate(() => ({
      expanded: document.getElementById('btn-image-desktop').getAttribute('aria-expanded'),
      hidden: document.getElementById('menu-image-desktop').classList.contains('hidden')
    }));
    assert(imageMenu.expanded === 'false' && imageMenu.hidden, 'El menu Imagen no se cerro al hacer click afuera.');

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
      window.refreshAsignacionesFromCloud = async () => {};
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
    await page.evaluate(() => window.descargarImagen('dispo'));

    const flyer = await page.evaluate(() => ({
      header: document.querySelector('#capture-target .flyer-title')?.textContent.trim() || '',
      month: document.getElementById('flyer-month')?.textContent.trim() || '',
      rows: document.querySelectorAll('#flyer-list .flyer-row').length,
      statuses: [...document.querySelectorAll('#flyer-list .flyer-status')].map((el) => el.textContent.trim()),
      downloads: window.__downloadClicks
    }));
    assert(flyer.header.includes('Mentes Brillantes'), 'El flyer no conserva encabezado institucional.');
    assert(flyer.month.length > 0, 'El flyer no tiene mes.');
    assert(flyer.rows > 0, 'El flyer no genero filas.');
    assert(flyer.statuses.some((text) => text.includes('Disponible') || text.includes('Cancelado')), 'El flyer no genero badges de estado.');
    assert(flyer.downloads === 1, 'El flujo de imagen no llego al paso de descarga simulado.');

    if (consoleErrors.length > 0) throw new Error(`Errores reales de consola: ${consoleErrors.join(' | ')}`);
    console.log('OK: interacciones Imagen, Admin, PDF, WhatsApp y flyer validadas sin tocar Firestore.');
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
