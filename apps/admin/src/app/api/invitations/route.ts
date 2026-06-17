import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await request.json();
  const { email, condominiumId, unitId, role = 'resident' } = body as {
    email?: string;
    condominiumId?: string;
    unitId?: string;
    role?: string;
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

  const { data, error } = await supabase
    .from('invitations')
    .insert({
      email: email.trim().toLowerCase(),
      condominium_id: condominiumId,
      unit_id: unitId ?? null,
      role,
      invited_by: user.id,
    })
    .select('id, email, role, status, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ invitation: data });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const condominiumId = searchParams.get('condominiumId');

  if (!condominiumId) {
    return NextResponse.json({ error: 'condominiumId requerido' }, { status: 400 });
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
