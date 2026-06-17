# Desplegar Veka en GitHub + Vercel

## Estado actual (producción)

| Recurso | URL |
|---------|-----|
| **GitHub** | https://github.com/edgarepidc/veka |
| **Admin (Vercel)** | https://veka-admin.vercel.app |
| **Supabase** | https://ubmtcwdgryfwldjfqwim.supabase.co |

Vercel ya está conectado al repo y redespliega con cada `git push` a `main`.

> `.env` y secretos **no** se suben (están en `.gitignore`).

## 1. GitHub

Repo: **edgarepidc/veka** — rama `main`.

```bash
git remote add origin https://github.com/edgarepidc/veka.git
git push -u origin main
```

## 2. Vercel

Proyecto: **veka-admin** en el team `edgarepidcs-projects`.

Variables de entorno ya configuradas (Production + Preview):

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ubmtcwdgryfwldjfqwim.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key del dashboard Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (solo servidor) |

El monorepo usa `vercel.json` en la raíz del repo para instalar y construir `@veka/admin`.

## 3. Supabase — URLs de producción (pendiente manual)

Abre [URL Configuration](https://supabase.com/dashboard/project/ubmtcwdgryfwldjfqwim/auth/url-configuration) y pega:

- **Site URL:** `https://veka-admin.vercel.app`
- **Redirect URLs** (una por línea):

```
https://veka-admin.vercel.app/**
https://*.vercel.app/**
http://localhost:3000/**
http://localhost:8081/**
veka://**
exp://**
```

Recomendado: en **Authentication → Providers → Email**, desactiva **Confirm email** mientras desarrollas.

O por CLI (con token en https://supabase.com/dashboard/account/tokens):

```bash
export SUPABASE_ACCESS_TOKEN=tu_token
bash scripts/configure-supabase-auth.sh https://veka-admin.vercel.app
```

## 4. App móvil (Expo)

La app móvil **no** va en Vercel. Opciones:

- **Desarrollo:** `npm run dev:mobile` + Expo Go
- **Producción:** [Expo EAS Build](https://docs.expo.dev/build/introduction/) cuando quieras publicar en stores

Variables en `apps/mobile/.env` (mismas `EXPO_PUBLIC_SUPABASE_*`).

## 5. Flujo de trabajo recomendado

```
Cursor (local) → git push → GitHub → Vercel (auto-deploy admin)
Supabase cloud ← misma BD para local y producción
Expo local / EAS ← app móvil
```

Cada `git push` a `main` redespliega el panel admin automáticamente.

## 6. CLI alternativa

```bash
npx vercel login
cd apps/admin
npx vercel link
npx vercel env pull ../../apps/admin/.env.local
npx vercel --prod
```
