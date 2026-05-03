const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const readmePath = path.join(root, 'README.md');
const logoPath = path.join(root, 'assets', 'mentes-brillantes-logo.jpeg');

console.log('Validando integridad del proyecto...');

// 1. Validar index.html
if (!fs.existsSync(indexPath)) {
  throw new Error('❌ Error: No existe index.html');
}

const indexContent = fs.readFileSync(indexPath, 'utf-8');

// 2. Validar que no hay rastro de "Imagen Disponibilidad" (UI vieja)
if (indexContent.includes('Imagen Disponibilidad')) {
  throw new Error('❌ Error: Se detectó "Imagen Disponibilidad" en index.html. Debe ser "Imagen" (directa).');
}

// 3. Validar IDs críticos
const criticalIds = ['grid-web', 'modal-apartar', 'modal-solicitudes', 'apartar-nombre', 'btn-login-admin'];
criticalIds.forEach(id => {
  if (!indexContent.includes(`id="${id}"`)) {
    throw new Error(`❌ Error: ID crítico faltante: ${id}`);
  }
});

// 4. Validar assets
if (!fs.existsSync(logoPath)) {
    console.warn('⚠️ Advertencia: No se encontró assets/logo-gemb.png');
}

// 5. Validar README
if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, 'utf-8');
    if (!readmeContent.includes('Imagen directa') && !readmeContent.includes('Descarga directa')) {
        throw new Error('❌ Error: El README.md no menciona la nueva funcionalidad de "Imagen directa".');
    }
}

console.log('✅ OK: Proyecto validado y listo para despliegue.');
