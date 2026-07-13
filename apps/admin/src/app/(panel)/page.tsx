import Link from 'next/link';
import { redirect } from 'next/navigation';

import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { APP_NAME } from '@veka/shared';

import { loadAdminSession } from '@/lib/load-admin-session';
import { formatHomeStatMoney, loadHomeStats } from '@/lib/load-home-stats';
import { panelHomePath } from '@/lib/route-access';

const modules = [
  { title: 'Finanzas', description: 'Cuotas, pagos, egresos y fondos.', href: '/finanzas', icon: '💳' },
  { title: 'Comunidad', description: 'Avisos, encuestas y documentos.', href: '/comunidad', icon: '💬' },
  { title: 'Espacios', description: 'Amenidades y reservas.', href: '/espacios', icon: '🏊' },
  { title: 'Seguridad', description: 'Visitas QR y paquetería.', href: '/seguridad', icon: '🔒' },
  {
    title: 'Mantenimiento',
    description: 'Tickets, calendarios y evidencia de trabajos.',
    href: '/mantenimiento',
    icon: '🔧',
  },
  {
    title: 'Configuración',
    description: 'Unidades, equipo y perfil.',
    href: '/configuracion',
    icon: '⚙️',
  },
];

export default async function AdminHomePage() {
  const session = await loadAdminSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect(panelHomePath(session));

  const condoName = session.membership?.condominium_name ?? 'Condominio';
  const stats =
    session.activeCondominiumId != null
      ? await loadHomeStats(session.activeCondominiumId)
      : null;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title={APP_NAME} highlight="admin" subtitle={condoName} />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatPill
          label="Fondo operativo"
          value={stats ? formatHomeStatMoney(stats.operatingBalance) : '—'}
        />
        <StatPill
          label="Fondo reserva"
          value={stats ? formatHomeStatMoney(stats.reserveBalance) : '—'}
        />
        <StatPill
          label="Unidades al día"
          value={stats?.unitsOnTimePercent != null ? `${stats.unitsOnTimePercent}%` : '—'}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {modules.map((module) => (
          <Link key={module.href} href={module.href}>
            <GlassCard className="transition hover:scale-[1.01] hover:border-emerald-400/30">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{module.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold text-[var(--text)]">{module.title}</h3>
                  <p className="mt-2 text-sm text-muted">{module.description}</p>
                </div>
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--text)]">{value}</p>
    </div>
  );
}
