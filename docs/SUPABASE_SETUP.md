# Conectar Veka a Supabase Cloud

## 1. Crear proyecto

1. Ve a [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Elige región cercana (ej. `South America` o `US East`)
3. Guarda la contraseña de la base de datos

## 2. Obtener credenciales

En **Project Settings → API** copia:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL`
- **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** → `SUPABASE_SERVICE_ROLE_KEY` (solo servidor, nunca en mobile)

## 3. Configurar variables locales

```bash
cp .env.example .env
cp apps/mobile/.env.example apps/mobile/.env
cp apps/admin/.env.example apps/admin/.env.local
```

Pega las credenciales en los tres archivos.

## 4. Enlazar CLI al proyecto cloud

```bash
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
```

El `project-ref` está en la URL del dashboard: `https://supabase.com/dashboard/project/TU_PROJECT_REF`

## 5. Aplicar migraciones en cloud

```bash
npx supabase db push
```

### Buckets de imágenes (avatars y branding)

Si ya aplicaste migraciones anteriores, ejecuta solo esta en el **SQL Editor**:

`supabase/migrations/20250617200000_avatars_and_branding_storage.sql`

Crea los buckets públicos `avatars` (fotos de perfil) y `branding` (logos de condominio).

## 6. Auth en Supabase Dashboard

En **Authentication → Providers**:

- Habilita **Email**
- Para desarrollo rápido: desactiva "Confirm email" en **Email settings**
- Opcional: habilita **Magic Link** o **OTP**

En **Authentication → URL Configuration**, agrega:

- Site URL: `http://localhost:3000` (admin)
- Redirect URLs: `http://localhost:3000/**`, `veka://**`

## 7. Crear primer administrador

Tras registrarte en el panel admin (`/login`):

1. En **SQL Editor** de Supabase, vincula tu usuario al condominio demo:

```sql
-- Reemplaza el email por el tuyo
insert into public.memberships (user_id, condominium_id, unit_id, role, status)
select
  u.id,
  '22222222-2222-2222-2222-222222222222',
  null,
  'admin',
  'active'
from auth.users u
where lower(u.email) = lower('tu@email.com')
on conflict do nothing;
```

## 8. Invitar residentes

Desde el panel **Configuración → Invitaciones** (o API):

- El admin ingresa email + unidad
- El residente se registra con ese email en la app móvil
- Al iniciar sesión, `accept_pending_invitations()` crea su membresía automáticamente

## Desarrollo local (alternativa)

```bash
npx supabase start
npx supabase db reset
```

Usa las credenciales locales que imprime `supabase start` en tus `.env`.
