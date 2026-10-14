/* El Calendario se mudó a Coordinación:
 *   https://coordinacion-gemb.vercel.app/calendario
 *
 * Este service worker reemplaza al anterior en los celulares que tenían la
 * app instalada: borra lo que quedó guardado, se desinstala y lleva a la
 * dirección nueva. El servidor (vercel.json) ya redirige todo lo demás.
 */
const NUEVO = 'https://coordinacion-gemb.vercel.app/calendario';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const k of await caches.keys()) await caches.delete(k);
      await self.registration.unregister();
      const ventanas = await self.clients.matchAll({ type: 'window' });
      for (const v of ventanas) {
        try {
          await v.navigate(NUEVO);
        } catch (e) {
          /* si no se puede, la próxima vez que se abra la redirige el servidor */
        }
      }
    })(),
  );
});
