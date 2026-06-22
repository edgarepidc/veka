interface FiscalProfileRow {
  legal_name: string;
  rfc: string;
  tax_regime: string;
  postal_code: string;
  pac_provider: string;
  pac_organization_id: string | null;
  default_series: string;
}

interface UnitTaxProfileRow {
  rfc: string;
  legal_name: string;
  tax_regime: string | null;
  postal_code: string;
  cfdi_use: string;
  email: string | null;
}

export interface StampCfdiInput {
  fiscalProfile: FiscalProfileRow;
  unitTax: UnitTaxProfileRow;
  amount: number;
  subtotal: number;
  iva: number;
  series: string;
  description: string;
}

export interface StampCfdiResult {
  uuid: string;
  series: string;
  folio: string;
  xmlUrl: string | null;
  pdfUrl: string | null;
  raw: Record<string, unknown>;
}

export async function stampCfdiInvoice(input: StampCfdiInput): Promise<StampCfdiResult> {
  const apiKey = process.env.FACTURAPI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('FACTURAPI_API_KEY no configurada. Agrega la llave del PAC en el servidor.');
  }

  const body = {
    type: 'I',
    series: input.series,
    payment_form: '03',
    payment_method: 'PUE',
    currency: 'MXN',
    customer: {
      legal_name: input.unitTax.legal_name,
      tax_id: input.unitTax.rfc,
      tax_system: input.unitTax.tax_regime ?? '616',
      email: input.unitTax.email ?? undefined,
      address: {
        zip: input.unitTax.postal_code,
      },
    },
    items: [
      {
        quantity: 1,
        product: {
          description: input.description,
          product_key: '80131501',
          unit_key: 'E48',
          unit_name: 'Servicio',
          price: input.subtotal,
          tax_included: false,
          taxes: [
            {
              type: 'IVA',
              rate: 0.16,
            },
          ],
        },
      },
    ],
  };

  const response = await fetch('https://www.facturapi.io/v2/invoices', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof payload.message === 'string'
        ? payload.message
        : JSON.stringify(payload);
    throw new Error(message || 'Facturapi rechazó el timbrado.');
  }

  return {
    uuid: String(payload.uuid ?? ''),
    series: String(payload.series ?? input.series),
    folio: String(payload.folio_number ?? payload.folio ?? ''),
    xmlUrl: typeof payload.xml === 'string' ? payload.xml : null,
    pdfUrl: typeof payload.pdf === 'string' ? payload.pdf : null,
    raw: payload,
  };
}
