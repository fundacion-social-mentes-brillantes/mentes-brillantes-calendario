# Reglas recomendadas para Firestore

No se encontraron reglas de Firestore dentro del proyecto local. Estas reglas son una base recomendada para revisar y adaptar en Firebase Console antes de produccion real.

## Objetivo

- Lectura publica limitada para mostrar calendario, mentores, asignaciones y solicitudes publicas minimas.
- Escritura publica solo para crear solicitudes de apartado pendientes.
- Escritura administrativa solo para usuarios autenticados y autorizados.
- Evitar que el frontend publico pueda modificar mentores, asignaciones, configuracion o estados de solicitudes.

## Reglas sugeridas

Estas reglas priorizan seguridad. Antes de aplicarlas, hay que ajustar el flujo publico de `solicitudes_publicas`, porque el codigo actual consulta `solicitudesApartado` desde el frontend publico para marcar fechas "En revision". Aplicar estas reglas sin ese ajuste puede ocultar esos estados para usuarios no autenticados.

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn() && request.auth.token.admin == true;
    }

    function validSolicitudCreate() {
      return request.resource.data.keys().hasOnly([
        'id',
        'created_at',
        'date_key',
        'fecha_texto',
        'actividad',
        'horario',
        'modalidad',
        'solicitante_nombre',
        'mensaje_whatsapp',
        'estado'
      ])
      && request.resource.data.estado == 'pendiente'
      && request.resource.data.date_key is string
      && request.resource.data.fecha_texto is string
      && request.resource.data.actividad is string
      && request.resource.data.horario is string
      && request.resource.data.modalidad is string
      && request.resource.data.solicitante_nombre is string
      && request.resource.data.mensaje_whatsapp is string;
    }

    match /mentores/{docId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    match /asignaciones/{docId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    match /configuracionDias/{docId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    match /configuracionBase/{docId} {
      allow read: if true;
      allow create, update, delete: if isAdmin();
    }

    match /solicitudesApartado/{docId} {
      allow read: if isAdmin();
      allow create: if validSolicitudCreate();
      allow update, delete: if isAdmin();
    }
  }
}
```

## Nota sobre admins

La funcion `isAdmin()` asume un custom claim `admin: true`. Si todavia no existe ese claim, hay que crearlo desde un entorno seguro de administracion, no desde el frontend. Como alternativa menos granular, se puede restringir por lista de emails, pero los custom claims son mas mantenibles.

## Compatibilidad con la app actual

Para mantener el comportamiento publico actual sin cambio de codigo, `solicitudesApartado` tendria que permitir lectura publica, lo cual puede exponer nombres y mensajes de solicitud. La opcion profesional recomendada es crear una coleccion publica minima, por ejemplo `solicitudesPublicas/{date_key}`, que solo contenga:

```js
{
  date_key: "2026-04-02",
  estado: "pendiente"
}
```

Despues, el frontend publico deberia leer esa coleccion minima y el panel admin seguiria leyendo `solicitudesApartado`.

## Importante

- Las claves `apiKey` de Firebase en frontend no son secretos por si solas, pero las reglas si son la barrera real.
- No confiar solo en botones ocultos para seguridad.
- Probar reglas con el Rules Simulator antes de publicarlas.

