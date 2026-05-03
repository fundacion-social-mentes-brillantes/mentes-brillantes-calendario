/**
 * SCRIPT PARA CONFIGURAR CUSTOM CLAIMS DE ADMINISTRADOR
 * 
 * Instrucciones:
 * 1. Instala el SDK de Admin: npm install firebase-admin
 * 2. Descarga tu archivo JSON de cuenta de servicio desde Firebase Console (Project Settings > Service Accounts).
 * 3. Coloca el JSON en este directorio o ajusta la ruta abajo.
 * 4. Ejecuta: node scripts/set-admin-claim.js <USER_UID>
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // AJUSTA ESTA RUTA

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const uid = process.argv[2];

if (!uid) {
  console.error('Error: Debes proporcionar un UID de usuario.');
  process.exit(1);
}

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`✅ Éxito: El usuario ${uid} ahora tiene permisos de admin.`);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error al asignar claims:', error);
    process.exit(1);
  });
