# Mentes Brillantes Calendario

Aplicacion web estatica para gestionar y publicar la programacion anual de Gimnasio Emocional Mentes Brillantes. La app vive principalmente en `index.html` y usa Firebase Auth + Firestore desde el frontend.

## Que hace

- Muestra el calendario mensual de actividades de 2026.
- Permite ver modalidad, horario, estado de disponibilidad y mentor asignado.
- Permite solicitar apartar una fecha desde el flujo publico.
- Permite a administradores asignar mentores, editar actividades puntuales, gestionar equipo, atender solicitudes y hacer backups.
- Genera **Imagen directa** de la programación (descarga inmediata de asignados) desde `#capture-target`.
- Genera vista imprimible para PDF con `window.print()`.
- Copia una programación textual para WhatsApp.
- **Seguridad**: Escapado de HTML (XSS) y prevención de duplicados en solicitudes.

## Uso basico

1. Abrir la URL publica de Vercel.
2. Elegir el mes desde los chips superiores.
3. En vista publica, usar `Apartar` en fechas disponibles.
4. Usar `Imagen`, `PDF` o `WhatsApp` para exportar la programacion.
5. Entrar por `Admin` solo con credenciales autorizadas.

## Admin

El boton `Admin` abre el login de Firebase Auth. Al iniciar sesion aparecen:

- Configuracion base: dias activos, actividad base, horario base y modalidad virtual fija.
- Equipo: lista de mentores disponibles.
- Solicitudes: solicitudes pendientes de apartado.
- Datos: descarga y restauracion de backup.

Importante: La seguridad no depende solo de ocultar botones. Se han implementado **Reglas de Firestore** que:
- Permiten lectura pública solo de colecciones necesarias (`mentores`, `asignaciones`, `configuracionBase`, `configuracionDias`).
- Permiten lectura pública de un estado mínimo en `solicitudesPublicas` para mostrar "En revisión".
- Protegen datos privados de `solicitudesApartado` (solo admin puede leer).
- Restringen escrituras administrativas a usuarios autenticados con permisos.
- Validan el esquema de datos en cada escritura.

## Backup

El menu `Datos` permite:

- Copia solo pendientes: exporta datos principales y solicitudes pendientes.
- Copia todo el historial: exporta tambien solicitudes atendidas/rechazadas cuando hay sesion admin.
- Restaurar copia: reemplaza datos actuales tras confirmacion. Usar con cuidado.

Los archivos generados siguen el patron `backup_mentes_brillantes_*.json` y estan ignorados por Git.

## Despliegue

El proyecto es estatico y compatible con Vercel. Despliegue usado:

```bash
npm install
npm test
npm run build
npx vercel deploy --prod --yes --logs
```

## CI/CD Profesional

El proyecto cuenta con **GitHub Actions** para integración continua. El flujo de trabajo (`ci.yml`):
1. Instala dependencias (`npm ci`).
2. Instala Playwright y navegadores.
3. Ejecuta todas las pruebas (`npm test`).
4. Valida el build (`npm run build`).

Cualquier Push o Pull Request a `main` disparará este proceso.

## Validacion local

Antes de desplegar, ejecutar:

```bash
npm install
npm test
npm run build
```

Scripts disponibles:

- `npm run test:js`: valida sintaxis de JavaScript inline en `index.html`.
- `npm run test:html`: verifica IDs criticos usados por la app.
- `npm run test:smoke`: abre la app en un servidor local con Playwright, simula Firebase sin tocar datos reales y revisa carga basica, meses, calendario, Imagen, PDF, WhatsApp y errores reales de consola.
- `npm test`: ejecuta todas las validaciones.
- `npm run build`: validacion estatica compatible con Vercel.

## Checklist antes de desplegar

- La app carga sin errores reales de consola.
- `npm test` pasa sin errores.
- `npm run build` pasa sin errores.
- El calendario muestra meses y tarjetas.
- Cambiar de mes funciona.
- Imagen descarga directamente la programación con los mentores asignados.
- PDF abre la impresion y mantiene logo/estilos.
- WhatsApp copia el texto.
- Admin abre login.
- Configuracion, Equipo, Solicitudes y Datos siguen ocultos sin sesion.
- Con sesion admin, asignar mentor pide confirmacion y guarda.
- Solicitudes abren, se atienden o rechazan segun permisos.
- Modales abren, cierran con boton y con Escape.
- Header y menus funcionan en movil.

## Zonas sensibles

- No cambiar IDs, `data-*`, `onclick` ni nombres de funciones sin revisar los usos.
- No modificar Firebase/Auth/Firestore sin revisar reglas y flujos de lectura/escritura.
- No cambiar `#capture-target`; lo usa la exportacion de imagen.
- No cambiar `.print-only`/`.pdf-*`; lo usa la exportacion PDF.
- No guardar secretos ni credenciales privadas en el repositorio.
