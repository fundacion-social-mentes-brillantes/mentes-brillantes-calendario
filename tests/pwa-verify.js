// Verificación PWA local (no forma parte de npm test). Sirve el proyecto y comprueba
// manifest, service worker e iconos en un navegador real, con captura móvil.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg', '.css': 'text/css', '.svg': 'image/svg+xml'
};

function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = path.join(root, urlPath);
    if (!filePath.startsWith(root) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    resolve({ server, url: `http://127.0.0.1:${server.address().port}` });
  }));
}

(async () => {
  const { server, url } = await startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1500);

  // 1) manifest fetch + validez
  const manifest = await page.evaluate(async () => {
    const r = await fetch('/manifest.webmanifest');
    return { ok: r.ok, ct: r.headers.get('content-type'), json: await r.json() };
  });
  // 2) service worker
  const swReady = await page.evaluate(() => navigator.serviceWorker
    ? navigator.serviceWorker.ready.then(() => true).catch(() => false)
    : Promise.resolve(false));
  // 3) meta/links PWA
  const head = await page.evaluate(() => ({
    manifestLink: !!document.querySelector('link[rel="manifest"]'),
    appleIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
    themeColor: document.querySelector('meta[name="theme-color"]')?.content || null,
    appleCapable: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]')
  }));
  // 4) iconos accesibles
  const icon = await page.evaluate(async () => {
    const r = await fetch('/assets/icon-512.png');
    return { ok: r.ok, ct: r.headers.get('content-type') };
  });

  await page.screenshot({ path: path.join(root, 'tests', 'pwa-mobile.png'), fullPage: false });

  console.log('manifest.ok        =', manifest.ok, '| icons:', manifest.json.icons?.length, '| name:', manifest.json.name);
  console.log('manifest.start_url =', manifest.json.start_url, '| display:', manifest.json.display);
  console.log('serviceWorker.ready=', swReady);
  console.log('head PWA tags      =', JSON.stringify(head));
  console.log('icon-512 reachable =', icon.ok, icon.ct);
  console.log('pageerrors         =', errors.length ? errors : 'ninguno');

  const pass = manifest.ok && manifest.json.icons?.length >= 2 && swReady &&
    head.manifestLink && head.appleIcon && head.themeColor && icon.ok && errors.length === 0;
  console.log(pass ? '\n✅ PWA OK: instalable y sin errores de página.' : '\n❌ PWA con problemas.');

  await browser.close();
  server.close();
  process.exit(pass ? 0 : 1);
})();
