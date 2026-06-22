'use server';

import { revalidatePath } from 'next/cache';
import {
  DEFAULT_APPROVAL_SETTINGS,
  DEFAULT_EXPENSE_ACCOUNT_MAPS,
  DEFAULT_INCOME_ACCOUNT_MAPS,
  isCfdiBillingEnabled,
  parseApprovalSettings,
} from '@veka/shared';

import { issueCfdiForPaymentManual } from '@/lib/cfdi';
import { parseCondominiumSettings } from '@/lib/condominium-settings';
import { DEMO_CONDO_ID } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';

function resolveCondoId(value?: string | null): string {
  const id = value?.trim();
  return id || DEMO_CONDO_ID;
}

export async function saveApprovalSettings(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const condominiumId = resolveCondoId(String(formData.get('condominium_id') ?? ''));
  const dualEnabled = formData.get('payments_dual_enabled') === 'true';
  const threshold = Number(formData.get('payments_dual_threshold') ?? DEFAULT_APPROVAL_SETTINGS.payments_dual_threshold);

  const { data: condo } = await supabase
    .from('condominiums')
    .select('settings')
    .eq('id', condominiumId)
    .single();

  if (!condo) return { error: 'Condominio no encontrado.' };

  const settings = parseCondominiumSettings(condo.settings);
  const nextSettings = {
    ...settings,
    approvals: parseApprovalSettings({
      payments_dual_enabled: dualEnabled,
      payments_dual_threshold: threshold,
    }),
  };

  const { error } = await supabase
    .from('condominiums')
    .update({ settings: nextSettings })
    .eq('id', condominiumId);

  if (error) return { error: error.message };
  revalidatePath('/finanzas');
  return { success: true };
}

export async function saveFiscalProfile(formData: FormData) {
  if (!isCfdiBillingEnabled()) {
    return { error: 'La facturación CFDI está deshabilitada por ahora.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const condominiumId = resolveCondoId(String(formData.get('condominium_id') ?? ''));
  const legalName = String(formData.get('legal_name') ?? '').trim();
  const rfc = String(formData.get('rfc') ?? '').trim().toUpperCase();
  const taxRegime = String(formData.get('tax_regime') ?? '').trim();
  const postalCode = String(formData.get('postal_code') ?? '').trim();
  const defaultSeries = String(formData.get('default_series') ?? 'A').trim() || 'A';
  const autoInvoice = formData.get('auto_invoice_on_approve') === 'true';
  const pacOrganizationId = String(formData.get('pac_organization_id') ?? '').trim();

  if (!legalName || !rfc || !taxRegime || !postalCode) {
    return { error: 'Completa razón social, RFC, régimen y CP.' };
  }

  const { error } = await supabase.from('fiscal_profiles').upsert(
    {
      condominium_id: condominiumId,
      legal_name: legalName,
      rfc,
      tax_regime: taxRegime,
      postal_code: postalCode,
      default_series: defaultSeries,
      auto_invoice_on_approve: autoInvoice,
      pac_organization_id: pacOrganizationId || null,
      pac_provider: 'facturapi',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'condominium_id' },
  );

  if (error) return { error: error.message };
  revalidatePath('/finanzas');
  return { success: true };
}

export async function saveUnitTaxProfile(formData: FormData) {
  if (!isCfdiBillingEnabled()) {
    return { error: 'La facturación CFDI está deshabilitada por ahora.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const unitId = String(formData.get('unit_id') ?? '').trim();
  const legalName = String(formData.get('legal_name') ?? '').trim();
  const rfc = String(formData.get('rfc') ?? '').trim().toUpperCase();
  const postalCode = String(formData.get('postal_code') ?? '').trim();
  const cfdiUse = String(formData.get('cfdi_use') ?? 'D10').trim() || 'D10';
  const email = String(formData.get('email') ?? '').trim();
  const taxRegime = String(formData.get('tax_regime') ?? '').trim();

  if (!unitId || !legalName || !rfc || !postalCode) {
    return { error: 'Completa unidad, razón social, RFC y CP.' };
  }

  const { error } = await supabase.from('unit_tax_profiles').upsert(
    {
      unit_id: unitId,
      legal_name: legalName,
      rfc,
      postal_code: postalCode,
      cfdi_use: cfdiUse,
      email: email || null,
      tax_regime: taxRegime || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'unit_id' },
  );

  if (error) return { error: error.message };
  revalidatePath('/finanzas');
  return { success: true };
}

export async function saveAccountingCategoryMap(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const condominiumId = resolveCondoId(String(formData.get('condominium_id') ?? ''));
  const movementType = String(formData.get('movement_type') ?? '') as 'income' | 'expense';
  const vekaCategory = String(formData.get('veka_category') ?? '').trim();
  const accountCode = String(formData.get('account_code') ?? '').trim();
  const accountName = String(formData.get('account_name') ?? '').trim();
  const fundType = String(formData.get('fund_type') ?? '').trim();

  if (!movementType || !vekaCategory || !accountCode) {
    return { error: 'Completa tipo, categoría y cuenta contable.' };
  }

  const { error } = await supabase.from('accounting_category_maps').upsert(
    {
      condominium_id: condominiumId,
      movement_type: movementType,
      veka_category: vekaCategory,
      account_code: accountCode,
      account_name: accountName || null,
      fund_type: fundType || null,
    },
    { onConflict: 'condominium_id,movement_type,veka_category,fund_type' },
  );

  if (error) return { error: error.message };
  revalidatePath('/finanzas');
  return { success: true };
}

export async function seedDefaultAccountingMaps(condominiumId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  const condoId = resolveCondoId(condominiumId);
  const rows = [...DEFAULT_INCOME_ACCOUNT_MAPS, ...DEFAULT_EXPENSE_ACCOUNT_MAPS].map((row) => ({
    condominium_id: condoId,
    movement_type: row.movement_type,
    veka_category: row.veka_category,
    account_code: row.account_code,
    account_name: row.account_name ?? null,
    fund_type: row.fund_type ?? null,
  }));

  const { error } = await supabase
    .from('accounting_category_maps')
    .upsert(rows, { onConflict: 'condominium_id,movement_type,veka_category,fund_type' });

  if (error) return { error: error.message };
  revalidatePath('/finanzas');
  return { success: true };
}

export async function stampPaymentCfdi(paymentId: string) {
  if (!isCfdiBillingEnabled()) {
    return { error: 'La facturación CFDI está deshabilitada por ahora.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autorizado' };

  return issueCfdiForPaymentManual(supabase, paymentId, user.id);
}
