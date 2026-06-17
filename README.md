# Veka

Plataforma de gestión condominal — app móvil para residentes y panel web para administración.

## Estructura

```
veka/
├── apps/
│   ├── mobile/     # Expo (React Native) — residentes y guardias
│   └── admin/      # Next.js — panel administrativo (Vercel)
├── packages/
│   ├── shared/     # Tipos, constantes y roles compartidos
│   └── supabase/   # Cliente Supabase tipado
└── supabase/
    ├── migrations/ # Esquema Postgres + RLS multi-tenant
    └── seed.sql    # Datos demo (Residencial Las Palmas)
```

## Requisitos

- Node.js 20+
- Docker Desktop (para Supabase local)
- Cuenta en [Supabase](https://supabase.com) y [Vercel](https://vercel.com)

## Inicio rápido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/admin/.env.example apps/admin/.env.local
```

### 3. Supabase local

```bash
npx supabase start
npx supabase db reset   # aplica migraciones + seed
```

Copia las credenciales que muestra `supabase start` en tus archivos `.env`.

### 4. Desarrollo

```bash
# App móvil (Expo)
npm run dev:mobile

# Panel admin (http://localhost:3000)
npm run dev:admin
```

## Módulos

| Módulo | Mobile | Admin | Estado |
|--------|--------|-------|--------|
| Dashboard | ✅ shell | ✅ shell | Setup |
| Finanzas | ✅ shell | ✅ shell | Próximo |
| Comunidad | ✅ shell | ✅ shell | Próximo |
| Espacios | ✅ shell | ✅ shell | Próximo |
| Seguridad | ✅ shell | ✅ shell | Próximo |

## Base de datos

El esquema incluye:

- Multi-tenant: `organizations` → `condominiums` → `clusters` → `units`
- Roles: `super_admin`, `admin`, `board_member`, `resident`, `guard`, `staff`
- Finanzas: cargos, pagos, egresos, fondos operativo/reserva
- Comunidad: posts, encuestas, reacciones, documentos
- Operación: amenidades, reservas, visitas QR, paquetería
- RLS en todas las tablas

## Despliegue

- **Admin**: conectar repo a Vercel, root directory `apps/admin`
- **Mobile**: `eas build` (Expo Application Services)
- **Supabase**: `npx supabase link` + `npx supabase db push`

## Próximos pasos

1. Conectar Supabase cloud y auth (email/OTP)
2. Implementar módulo de finanzas (cuotas + comprobantes)
3. Visitas QR + rol guardia
4. Push notifications (Expo + cron)
5. Pagos Stripe
