import { resolveStorageImageUrl, STORAGE_BUCKETS } from '@veka/shared';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

export function timeOfDayGreeting(now = new Date(), timeZone = 'America/Mexico_City'): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone }).format(now),
  );
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function AdminHomeHero({
  greeting,
  firstName,
  condominiumName,
  logoPath,
}: {
  greeting: string;
  firstName: string;
  condominiumName: string;
  logoPath?: string | null;
}) {
  const logoUrl = resolveStorageImageUrl(SUPABASE_URL, logoPath, STORAGE_BUCKETS.BRANDING);

  return (
    <section className="home-enter home-hero mb-8 overflow-hidden px-1 py-2 sm:px-0">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="home-enter home-enter-delay-1 text-sm font-medium text-muted">
            {greeting}, {firstName}
          </p>
          <h1 className="home-enter home-enter-delay-2 serif-title mt-2 max-w-xl text-4xl leading-tight text-[var(--text)] sm:text-5xl">
            {condominiumName}
          </h1>
          <p className="home-enter home-enter-delay-3 mt-3 max-w-lg text-sm text-muted">
            Resumen de hoy: operaciones, finanzas y espacios.
          </p>
        </div>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="home-enter home-enter-delay-2 h-16 w-16 shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] object-contain p-1.5 sm:h-20 sm:w-20"
          />
        ) : null}
      </div>
    </section>
  );
}
