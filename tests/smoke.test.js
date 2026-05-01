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
      signInWithEmailAndPassword: async function () { throw new Error('Auth deshabilitado en smoke test'); },
      signOut: async function () {}
    };
  },
  firestore: function () {
    const emptySnapshot = { docs: [] };
    const collectionApi = {
      get: async function () { return emptySnapshot; },
      doc: function (id) {
        return { id: id || 'smoke-doc', data: function () { return {}; } };
      }
    };
    return {
      enablePersistence: function () { return Promise.resolve(); },
      collection: function () { return collectionApi; },
      batch: function () {
        return {
          set: function () {},
          delete: function () {},
          commit: async function () {}
        };
      }
    };
  }
};
`;

async function main() {
  if (!fs.existsSync(indexPath)) throw new Error('No existe index.html.');

  const { server, url } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const consoleErrors = [];

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

    const checks = await page.evaluate(() => ({
      title: document.title,
      monthChips: document.querySelectorAll('#meses-container button').length,
      kpiCards: document.querySelectorAll('#month-summary-kpis [data-kpi]').length,
      calendarCards: document.querySelectorAll('#grid-web > div').length,
      imageDesktop: !!document.getElementById('btn-image-desktop'),
      imageMobile: !!document.getElementById('btn-image-mobile'),
      whatsapp: !!document.querySelector('button[onclick="copiarParaWhatsapp()"]'),
      pdf: !!document.querySelector('button[onclick="window.print()"]')
    }));

    if (!checks.title) throw new Error('La pagina no tiene titulo.');
    if (checks.monthChips < 1) throw new Error('No aparecen chips de meses.');
    if (checks.kpiCards !== 4) throw new Error('No aparecen las 4 tarjetas KPI del mes.');
    if (checks.calendarCards < 1) throw new Error('No aparece el grid del calendario.');
    if (!checks.imageDesktop || !checks.imageMobile) throw new Error('No existe el boton Imagen.');
    if (!checks.whatsapp) throw new Error('No existe el boton WhatsApp.');
    if (!checks.pdf) throw new Error('No existe el boton PDF.');
    if (consoleErrors.length > 0) throw new Error(`Errores reales de consola: ${consoleErrors.join(' | ')}`);

    console.log(`OK: smoke test cargo "${checks.title}" con ${checks.monthChips} meses y ${checks.calendarCards} tarjetas.`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
