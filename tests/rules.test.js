const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const fs = require('fs');
const path = require('path');

let testEnv;

describe('Firestore Security Rules Hardening', () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'mentes-brillantes-test',
      firestore: {
        rules: fs.readFileSync(path.resolve(__dirname, '../firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  const getUnauthDb = () => testEnv.unauthenticatedContext().firestore();
  const getAdminDb = () => testEnv.authenticatedContext('admin_user', { admin: true }).firestore();
  const getUserDb = () => testEnv.authenticatedContext('normal_user').firestore();

  describe('solicitudesPublicas', () => {
    const dateKey = '2026-05-10';
    
    test('permitir lectura pública', async () => {
      await assertSucceeds(getUnauthDb().collection('solicitudesPublicas').get());
    });

    test('permitir creación con campos exactos y estado pendiente', async () => {
      await assertSucceeds(getUnauthDb().collection('solicitudesPublicas').doc(dateKey).set({
        date_key: dateKey,
        estado: 'pendiente',
        created_at: new Date()
      }));
    });

    test('RECHAZAR si tiene campos extra', async () => {
      await assertFails(getUnauthDb().collection('solicitudesPublicas').doc(dateKey).set({
        date_key: dateKey,
        estado: 'pendiente',
        created_at: new Date(),
        hacker: 'field'
      }));
    });

    test('RECHAZAR si el estado no es pendiente', async () => {
      await assertFails(getUnauthDb().collection('solicitudesPublicas').doc(dateKey).set({
        date_key: dateKey,
        estado: 'aprobado',
        created_at: new Date()
      }));
    });

    test('RECHAZAR si date_key no coincide con docId', async () => {
      await assertFails(getUnauthDb().collection('solicitudesPublicas').doc('otro-id').set({
        date_key: dateKey,
        estado: 'pendiente',
        created_at: new Date()
      }));
    });
  });

  describe('solicitudesApartado (Duplicados y Seguridad)', () => {
    const dateKey = '2026-06-15';
    const validData = {
      id: dateKey,
      created_at: new Date(),
      date_key: dateKey,
      fecha_texto: '15 de Junio',
      actividad: 'Test',
      horario: '10:00',
      modalidad: 'Virtual',
      solicitante_nombre: 'Test User',
      mensaje_whatsapp: 'Hola',
      estado: 'pendiente'
    };

    test('RECHAZAR creación si el docId NO es la date_key (Prevención duplicados)', async () => {
      await assertFails(getUnauthDb().collection('solicitudesApartado').doc('random-id').set({
        ...validData,
        id: 'random-id'
      }));
    });

    test('PERMITIR creación si el docId ES la date_key', async () => {
      await assertSucceeds(getUnauthDb().collection('solicitudesApartado').doc(dateKey).set(validData));
    });

    test('RECHAZAR si la fecha ya está en asignaciones', async () => {
      // Primero el admin crea una asignación
      const adminDb = getAdminDb();
      await adminDb.collection('asignaciones').doc(dateKey).set({ mentor: 'Admin' });

      // Luego el público intenta apartar la misma fecha
      await assertFails(getUnauthDb().collection('solicitudesApartado').doc(dateKey).set(validData));
    });
  });

  describe('Admin Permissions', () => {
    test('Solo admin puede borrar asignaciones', async () => {
      const db = getUnauthDb();
      await assertFails(db.collection('asignaciones').doc('123').delete());
      
      const adminDb = getAdminDb();
      await assertSucceeds(adminDb.collection('asignaciones').doc('123').set({test:1}));
      await assertSucceeds(adminDb.collection('asignaciones').doc('123').delete());
    });

    test('Usuario autenticado SIN claim admin es rechazado', async () => {
      const userDb = getUserDb();
      await assertFails(userDb.collection('asignaciones').doc('123').set({test:1}));
    });
  });
});
