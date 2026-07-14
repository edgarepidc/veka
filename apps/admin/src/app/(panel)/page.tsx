import { redirect } from 'next/navigation';

import { AdminHomeHero, timeOfDayGreeting } from '@/components/home/AdminHomeHero';
import { AdminHomeFinancePanel, AdminHomeSpacesPanel } from '@/components/home/AdminHomeInsights';
import { AdminHomeFundRow, AdminHomePulseStrip } from '@/components/home/AdminHomePulseStrip';
import { loadAdminSession } from '@/lib/load-admin-session';
import { loadCondominium } from '@/lib/load-condominium';
import { loadHomeStats } from '@/lib/load-home-stats';
import { panelHomePath } from '@/lib/route-access';

export default async function AdminHomePage() {
  const session = await loadAdminSession();
  if (!session) redirect('/login');
  if (!session.isAdmin) redirect(panelHomePath(session));

  const condoName = session.membership?.condominium_name ?? 'Condominio';
  const condo =
    session.activeCondominiumId != null
      ? await loadCondominium(session.activeCondominiumId)
      : null;
  const stats =
    session.activeCondominiumId != null
      ? await loadHomeStats(session.activeCondominiumId)
      : null;

  const displayName =
    session.profile.full_name?.trim() || session.email.split('@')[0] || 'Administrador';
  const firstName = displayName.split(/\s+/)[0] ?? displayName;
  const greeting = timeOfDayGreeting(new Date(), condo?.timezone ?? 'America/Mexico_City');

  return (
    <div className="mx-auto max-w-6xl">
      <AdminHomeHero
        greeting={greeting}
        firstName={firstName}
        condominiumName={condoName}
        logoPath={condo?.settings.branding?.logo_url}
      />
      <AdminHomePulseStrip stats={stats} />
      <AdminHomeFundRow stats={stats} />
      <div className="grid gap-6 lg:grid-cols-2">
        <AdminHomeFinancePanel stats={stats} />
        <AdminHomeSpacesPanel stats={stats} />
      </div>
    </div>
  );
}
