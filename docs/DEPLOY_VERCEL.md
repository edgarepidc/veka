# Desplegar Veka en GitHub + Vercel

## 1. Subir a GitHub

```bash
cd "/Users/epgimeniodiaz/Library/CloudStorage/OneDrive-Personal/Documentos/03 Entrepreneur/Veka"

# Crear repo en github.com → New repository → nombre: veka (sin README)

git remote add origin https://github.com/TU_USUARIO/veka.git
git push -u origin main
```

> `.env` y secretos **no** se suben (están en `.gitignore`).

## 2. Conectar Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
2. Selecciona el repo `veka`
3. Configuración del proyecto:

| Campo | Valor |
|-------|--------|
| **Framework** | Next.js |
| **Root Directory** | `apps/admin` |
| **Build Command** | (dejar el de `vercel.json`) |
| **Install Command** | (dejar el de `vercel.json`) |

4. **Environment Variables** (Production + Preview):

| Variable | Valor |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://ubmtcwdgryfwldjfqwim.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key del dashboard Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (solo servidor) |

5. **Deploy**

Tu panel quedará en una URL como `https://veka-xxx.vercel.app`

## 3. Supabase — URLs de producción

En **Authentication → URL Configuration**:

- **Site URL:** `https://TU-PROYECTO.vercel.app`
- **Redirect URLs:** agrega:
  - `https://TU-PROYECTO.vercel.app/**`
  - `https://*.vercel.app/**` (previews)
  - `http://localhost:3000/**` (desarrollo local)

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
