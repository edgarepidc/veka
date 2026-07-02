import { redirect } from 'next/navigation';

import { GlassCard } from '@/components/ui/GlassCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { loadUserCondominiums } from '@/lib/condominium-context';
import { createClient } from '@/lib/supabase/server';

import { OnboardingForm } from './OnboardingForm';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const condominiums = await loadUserCondominiums(user.id);
  if (condominiums.length > 0) redirect('/');

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <PageHeader
        title="Bienvenido"
        highlight="a Veka"
        subtitle="Crea tu condominio para empezar a administrar cuotas, residentes y operación diaria."
      />
      <GlassCard>
        <OnboardingForm />
      </GlassCard>
    </div>
  );
}
