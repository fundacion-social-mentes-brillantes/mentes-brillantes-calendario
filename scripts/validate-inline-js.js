const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const htmlPath = path.join(root, 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attrs]) => !/\bsrc\s*=/i.test(attrs))
  .map((match) => match[2].trim())
  .filter(Boolean);

if (scripts.length === 0) {
  throw new Error('No se encontraron scripts inline para validar.');
}

scripts.forEach((script, index) => {
  try {
    new Function(script);
  } catch (error) {
    error.message = `Error de sintaxis en script inline #${index + 1}: ${error.message}`;
    throw error;
  }
});

console.log(`OK: ${scripts.length} script(s) inline tienen sintaxis valida.`);
