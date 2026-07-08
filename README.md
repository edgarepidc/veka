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
| Dashboard | ✅ | ✅ KPIs y accesos | Piloto |
| Finanzas | ✅ cargos y pagos | ✅ cargos, egresos, importación | Piloto |
| Comunidad | ✅ avisos, encuestas, docs | ✅ avisos, encuestas, upload docs | Piloto |
| Espacios | ✅ reservas y calendario | ✅ aprobación y reglas | Piloto |
| Seguridad | ✅ visitas QR y paquetes | ✅ caseta y notificaciones | Piloto |
| Mantenimiento | ✅ tickets | ✅ estados y evidencia | Piloto |

Guía del piloto demo: [docs/PILOTO_LAS_PALMAS.md](docs/PILOTO_LAS_PALMAS.md)

## CI

GitHub Actions ejecuta `typecheck` y `test:shared` en cada push/PR a `main` (ver `.github/workflows/ci.yml`).

## Base de datos

El esquema incluye:

- Multi-tenant: `organizations` → `condominiums` → `clusters` → `units`
- Roles: `super_admin`, `admin`, `board_member`, `resident`, `guard`, `staff`
- Finanzas: cargos, pagos, egresos, fondos operativo/reserva
- Comunidad: posts, encuestas, reacciones, documentos
- Operación: amenidades, reservas, visitas QR, paquetería
- RLS en todas las tablas

## Despliegue

Guía paso a paso: [docs/DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md)

- **GitHub** → push del repo
- **Vercel** → importar repo, root directory `apps/admin`, variables Supabase
- **Supabase** → agregar URL de Vercel en Auth redirects
- **Mobile** → Expo local o EAS Build (no va en Vercel)

## Próximos pasos

1. Conectar Supabase Cloud — ver [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)
2. Ejecutar piloto Las Palmas — ver [docs/PILOTO_LAS_PALMAS.md](docs/PILOTO_LAS_PALMAS.md)
3. Crear admin en SQL Editor y enviar invitaciones desde `/configuracion`
4. Residentes se registran en la app móvil y ven finanzas en `/finance`
5. Pagos Stripe en línea
