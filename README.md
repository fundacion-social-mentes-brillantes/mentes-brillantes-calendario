# Mentes Brillantes Calendario

Aplicacion web estatica para gestionar y publicar la programacion anual de Gimnasio Emocional Mentes Brillantes. La app vive principalmente en `index.html` y usa Firebase Auth + Firestore desde el frontend.

## Que hace

- Muestra el calendario mensual de actividades de 2026.
- Permite ver modalidad, horario, estado de disponibilidad y mentor asignado.
- Permite solicitar apartar una fecha desde el flujo publico.
- Permite a administradores asignar mentores, editar actividades puntuales, gestionar equipo, atender solicitudes y hacer backups.
- Genera imagen de disponibilidad/asignados desde `#capture-target`.
- Genera vista imprimible para PDF con `window.print()`.
- Copia una programacion textual para WhatsApp.

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

Importante: ocultar botones en el frontend no debe ser la unica seguridad. Firestore debe tener reglas que restrinjan escrituras administrativas a usuarios autenticados/autorizados.

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

La carpeta `.vercel` es metadata local y esta ignorada en `.gitignore`.

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
- Imagen abre el menu y genera archivo/compartir segun dispositivo.
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
