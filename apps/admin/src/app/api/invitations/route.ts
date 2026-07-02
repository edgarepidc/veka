import { NextResponse } from 'next/server';

import { sendInvitationEmail } from '@/lib/invitation-email';
import { createClient } from '@/lib/supabase/server';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super admin',
  admin: 'Administrador',
  board_member: 'Mesa directiva',
  resident: 'Residente',
  guard: 'Guardia',
  staff: 'Personal',
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const { email, condominiumId, unitId, role = 'resident', unitRelationship } = body as {
    email?: string;
    condominiumId?: string;
    unitId?: string;
    role?: string;
    unitRelationship?: string;
  };

  if (!email || !condominiumId) {
    return NextResponse.json({ error: 'email y condominiumId son requeridos' }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('condominium_id', condominiumId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership || !['admin', 'super_admin'].includes(membership.role as string)) {
    return NextResponse.json({ error: 'Sin permisos de administrador' }, { status: 403 });
  }

  const [{ data: condo }, { data: unit }] = await Promise.all([
    supabase.from('condominiums').select('name').eq('id', condominiumId).maybeSingle(),
    unitId
      ? supabase.from('units').select('identifier').eq('id', unitId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      email: email.trim().toLowerCase(),
      condominium_id: condominiumId,
      unit_id: unitId ?? null,
      role,
      unit_relationship:
        unitRelationship === 'owner' || unitRelationship === 'tenant' ? unitRelationship : null,
      invited_by: user.id,
    })
    .select('id, email, role, status, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const emailed = await sendInvitationEmail({
    to: data.email,
    condominiumName: condo?.name ?? 'tu condominio',
    unitLabel: unit?.identifier,
    roleLabel: ROLE_LABELS[role] ?? role,
  });

  return NextResponse.json({ invitation: data, emailSent: emailed });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const condominiumId = searchParams.get('condominiumId');

  if (!condominiumId) {
    return NextResponse.json({ error: 'condominiumId requerido' }, { status: 400 });
  }

  const { data: membership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('condominium_id', condominiumId)
    .eq('status', 'active')
    .maybeSingle();

  if (!membership || !['admin', 'super_admin'].includes(membership.role as string)) {
    return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, role, status, created_at, unit:units(identifier)')
    .eq('condominium_id', condominiumId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ invitations: data });
}
