import Link from 'next/link';

import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadPlatformStats } from '@/lib/load-platform-data';

export default async function PlatformHomePage() {
  const stats = await loadPlatformStats();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Veka"
        highlight="Platform"
        subtitle="Alta de condominios, asignación de administradores y visibilidad de usuarios por tenant."
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Organizaciones" value={stats.organizations} />
        <Stat label="Condominios" value={stats.condominiums} />
        <Stat label="Membresías activas" value={stats.activeMemberships} />
        <Stat label="Invitaciones pendientes" value={stats.pendingInvitations} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <GlassCard>
          <h2 className="text-lg font-semibold text-[var(--text)]">Condominios</h2>
          <p className="mt-2 text-sm text-muted">
            Lista todos los condominios, usuarios asignados y da de alta nuevos clientes.
          </p>
          <Link href="/platform/condominios" className="glass-btn-primary mt-4 inline-block text-sm">
            Ver condominios
          </Link>
        </GlassCard>
        <GlassCard>
          <h2 className="text-lg font-semibold text-[var(--text)]">Nuevo condominio</h2>
          <p className="mt-2 text-sm text-muted">
            Crea organización + condominio y asigna el primer administrador por correo.
          </p>
          <Link href="/platform/condominios/nuevo" className="glass-btn-primary mt-4 inline-block text-sm">
            Dar de alta
          </Link>
        </GlassCard>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="glass-card px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--text)]">{value}</p>
    </div>
  );
}
