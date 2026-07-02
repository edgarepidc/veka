const DEFAULT_FROM = 'Veka <recordatorios@vekacondo.com>';

export async function sendInvitationEmail(input: {
  to: string;
  condominiumName: string;
  unitLabel?: string | null;
  roleLabel: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || DEFAULT_FROM;
  const adminUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://veka-admin.vercel.app';
  const mobileAppUrl = 'veka://login';

  if (!apiKey) return false;

  const unitLine = input.unitLabel ? `<p>Unidad: <strong>${input.unitLabel}</strong></p>` : '';
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
      <h2>Invitación a ${input.condominiumName}</h2>
      <p>Te invitaron a unirte como <strong>${input.roleLabel}</strong> en Veka.</p>
      ${unitLine}
      <p>Para activar tu acceso, regístrate o inicia sesión con este correo:</p>
      <p style="font-size:16px"><strong>${input.to}</strong></p>
      <p style="margin-top:20px">
        <a href="${mobileAppUrl}" style="display:inline-block;background:#34d399;color:#0f172a;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">
          Abrir app Veka
        </a>
      </p>
      <p style="margin-top:12px;font-size:13px;color:#64748b">
        Si no tienes la app instalada, descárgala y luego usa el botón de arriba o regístrate con el mismo correo.
      </p>
      <p style="margin-top:16px;font-size:13px">
        Portal web (residentes y administradores): <a href="${adminUrl}/login">${adminUrl}/login</a>
      </p>
      <p style="color:#64748b;font-size:12px;margin-top:20px">Si no esperabas este correo, puedes ignorarlo.</p>
    </div>
  `;

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: `Invitación a ${input.condominiumName} — Veka`,
      html,
    }),
  });

  return response.ok;
}
