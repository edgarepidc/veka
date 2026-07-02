'use server';

import { platformUpdateCondominium } from '@/app/platform/actions';

export async function savePlatformCondominiumConfig(condominiumId: string, formData: FormData) {
  formData.set('condominium_id', condominiumId);
  return platformUpdateCondominium(formData);
}
