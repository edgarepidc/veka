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

  if (!apiKey) return false;

  const unitLine = input.unitLabel ? `<p>Unidad: <strong>${input.unitLabel}</strong></p>` : '';
  const html = `
    <div style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
      <h2>Invitación a ${input.condominiumName}</h2>
      <p>Te invitaron a unirte como <strong>${input.roleLabel}</strong> en Veka.</p>
      ${unitLine}
      <p>Para activar tu acceso:</p>
      <ol>
        <li>Descarga la app móvil Veka (o entra al portal residente).</li>
        <li>Regístrate o inicia sesión con este correo: <strong>${input.to}</strong></li>
      </ol>
      <p>
        Portal web: <a href="${adminUrl}/login">${adminUrl}/login</a>
      </p>
      <p style="color:#64748b;font-size:12px">Si no esperabas este correo, puedes ignorarlo.</p>
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
