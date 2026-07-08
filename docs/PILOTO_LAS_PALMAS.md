# Piloto demo — Residencial Las Palmas

Guía para demostrar Veka con datos narrativos en **Residencial Las Palmas** (`condominium_id`: `22222222-2222-2222-2222-222222222222`).

## Cuentas demo

| Rol | Acceso | Notas |
|-----|--------|-------|
| Residente móvil | `diazcruzee@outlook.com` | Unidad **A-102** |
| Admin panel | Usuario staff del condominio | `veka-admin.vercel.app` |

## Datos precargados (seed)

Tras `npm run db:reset` o `npm run seed:pilot-demo` en producción:

- **Comunidad:** aviso fijado (mantenimiento alberca), encuesta formal de jardinería Q3
- **Espacios:** reserva confirmada Alberca (mañana 18:00), reserva pendiente Salón (+10 días)
- **Seguridad:** visita activa (Carlos Méndez, QR fijo), paquete Amazon en caseta
- **Documentos:** reglamento interno y minuta asamblea (PDF demo)
- **Mantenimiento:** ticket abierto de plomería en A-102; calendario de alberca; evidencia de inspección

## Checklist de demostración

### App móvil (residente)

1. **Inicio** — saludo, stats y accesos rápidos con superficie editorial
2. **Finanzas** — cargos, pagos y popup de adeudos si aplica
3. **Comunidad** — aviso fijado, votar encuesta formal, abrir documentos
4. **Espacios** — ver disponibilidad, reserva confirmada y pendiente; crear reserva que requiera aprobación
5. **Seguridad** — pestaña Visitas (QR activo), pestaña Paquetes (Amazon en caseta)
6. **Mantenimiento** — ticket abierto; calendarios y evidencia; recibir push al cambiar estado desde admin

### Panel admin

1. **Espacios** — aprobar/rechazar reserva pendiente (push al residente)
2. **Comunidad** — publicar aviso, encuesta o subir documento PDF
3. **Seguridad** — registrar paquete (push deep link `security` → tab `paquetes`)
4. **Mantenimiento** — cambiar estado del ticket (push `maintenance` + `ticketId`); filtrar tickets activos

### Push y deep links

| Evento | Pantalla destino |
|--------|------------------|
| Paquete en caseta | Seguridad → Paquetes |
| Reserva aprobada/rechazada | Espacios (+ `reservationId`) |
| Nueva reserva pendiente | Admin (email/push staff) |
| Ticket mantenimiento | Mantenimiento (+ `ticketId`) |
| Nuevo ticket (staff) | Email/push al admin |
| Recordatorio de pago | Finanzas |

## Scripts útiles

```bash
# Local: migraciones + seed completo
npm run db:reset

# Producción: solo datos demo del piloto (requiere DATABASE_URL)
npm run seed:pilot-demo

# Reglas de amenidades Las Palmas
npm run seed:amenity-rules
```

## Verificación rápida

```bash
npm run typecheck
npm run test:shared
```

## Producción

- Admin: https://veka-admin.vercel.app
- Supabase: proyecto `ubmtcwdgryfwldjfqwim`
- Mobile: build EAS con `EXPO_PUBLIC_ADMIN_URL=https://veka-admin.vercel.app`
