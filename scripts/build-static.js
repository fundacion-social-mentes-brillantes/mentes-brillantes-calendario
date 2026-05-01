const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');

if (!fs.existsSync(indexPath)) {
  throw new Error('No existe index.html; Vercel no tendria entrada estatica.');
}

console.log('OK: proyecto estatico listo para Vercel.');
