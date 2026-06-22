/** CFDI / Facturapi billing. Disabled unless explicitly enabled in env. */
export function isCfdiBillingEnabled(): boolean {
  const flag = process.env.CFDI_BILLING_ENABLED ?? process.env.NEXT_PUBLIC_CFDI_BILLING_ENABLED;
  return flag === 'true' || flag === '1';
}
