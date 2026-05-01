const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const criticalIds = [
  'grid-web',
  'meses-container',
  'month-summary-kpis',
  'capture-target',
  'modal-login',
  'btn-image-desktop',
  'btn-image-mobile',
  'btn-backup-menu',
  'menu-backup-admin',
  'modal-apartar',
  'modal-solicitudes'
];

const missing = criticalIds.filter((id) => !new RegExp(`\\bid=["']${id}["']`).test(html));

if (missing.length > 0) {
  throw new Error(`Faltan IDs criticos en index.html: ${missing.join(', ')}`);
}

console.log(`OK: ${criticalIds.length} IDs criticos encontrados.`);
