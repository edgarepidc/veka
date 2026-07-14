# Checklist de lanzamiento — Veka móvil

Guía operativa antes de TestFlight / Play internal. Complementa [`PILOTO_LAS_PALMAS.md`](./PILOTO_LAS_PALMAS.md).

## 1. Builds EAS

| Perfil | Uso |
|--------|-----|
| `development` | Dev client interno |
| `preview` | Dispositivo real (QR caseta, push, fotos) — **preferir esto vs Expo Go** |
| `production` | TestFlight / Play |

```bash
cd apps/mobile
# Una vez: eas init  → copia el projectId a EXPO_PUBLIC_EAS_PROJECT_ID
export EXPO_PUBLIC_EAS_PROJECT_ID="<uuid-del-proyecto>"
npx eas build --profile preview --platform ios
npx eas build --profile preview --platform android
```

- Bundle / package: `com.veka.condo`
- Versión app: `0.1.0` (`app.json`) + autoIncrement en production
- Confirmar `EXPO_PUBLIC_ADMIN_URL=https://veka-admin.vercel.app` en el perfil EAS
- Tras el build: `npx eas submit --profile production` (iOS → TestFlight, Android → track interno)

## 2. Permisos en dispositivo

- [ ] Notificaciones autorizadas (iOS / Android channel `Recordatorios`)
- [ ] Cámara (caseta: escaneo QR)
- [ ] Fotos / galería (paquete, evidencia de mantenimiento, guardar pase)
- [ ] Fila en `push_tokens` para el usuario de prueba tras abrir la app en **build físico**

## 3. Matriz push + deep links

| Evento | Destino residente | Destino field |
|--------|-------------------|---------------|
| Visita check-in / check-out | Seguridad → Visitas | Guard: Caseta |
| Paquete en caseta | Seguridad → Paquetes | Guard: Paquetes |
| Ticket status / nuevo ticket | Mantenimiento (+ `ticketId`) | Staff: Tickets |
| Reserva aprobada / pendiente | Espacios | — |
| Recordatorio / pago | Finanzas | — |
| Aviso comunidad | Comunidad (+ `postId`) | — |

Smoke en build preview:

1. Guard registra ingreso QR → push al residente de la unidad.
2. Guard registra salida → segundo push.
3. Guard registra paquete → push `paquetes`.
4. Staff cambia ticket a En progreso / Resuelto → push residente.
5. Admin aprueba reserva / genera cargo → push correspondiente.
6. Tap en cada notificación abre la pantalla correcta según rol.

## 4. Escenarios RLS multi-torre

Migración: `20250714120000_ticket_cluster_and_visit_unitmates.sql`

- [ ] Residente Torre A **no** lee tickets de Torre B vía API/PostgREST (solo UI no basta).
- [ ] Tickets sin cluster / unidad general sí son visibles a miembros del condo.
- [ ] Staff/admin/guard leen tickets de todas las torres.
- [ ] Dos residentes de la misma unidad ven las visitas de esa unidad.
- [ ] Residente de otra torre **no** ve esas visitas.
- Amenidades y paquetes siguen condo-wide a propósito (fase 2 si hay amenidades estrictamente por torre).
- Membership primaria: primera `created_at` activa; multi-condo aún no tiene selector de condo en app.

## 5. Caseta + staff en dispositivo

### Guard (`/(guard)/security`)

- [ ] Validar pase (cámara + referencia manual)
- [ ] Confirmación «Ingreso autorizado» / «Ya dentro»
- [ ] Operaciones: visitas del día + registrar salida
- [ ] Paquetes: registrar con foto + notificar; marcar entregado

### Staff (`/(staff)/maintenance`)

- [ ] Tab Tickets: listado, chips de estado, push al residente
- [ ] Tab Mensual: evidencia fotográfica y trabajos a demanda
- [ ] Deep link de «nuevo ticket» abre tab Tickets

## 6. Cuentas piloto

Ver [`PILOTO_LAS_PALMAS.md`](./PILOTO_LAS_PALMAS.md) — residente A-102, admin panel, invitaciones de guard/staff en Las Palmas.

## 7. Bloqueadores conocidos

- Sin `EXPO_PUBLIC_EAS_PROJECT_ID` / projectId en builds no-EAS, el registro de token puede fallar en silencio.
- Push solo en dispositivo físico (`Device.isDevice`).
- Comentarios de comunidad: inbox in-app, sin Expo push.
- Flujo real de cobros (gateway) → sprint siguiente.
