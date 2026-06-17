import Link from 'next/link';

import { APP_NAME } from '@veka/shared';

const modules = [
  {
    title: 'Finanzas',
    description: 'Cuotas, pagos, egresos, fondos y morosidad.',
    href: '/finanzas',
  },
  {
    title: 'Comunidad',
    description: 'Avisos, encuestas, documentos y moderación.',
    href: '/comunidad',
  },
  {
    title: 'Espacios',
    description: 'Amenidades, horarios y reservas.',
    href: '/espacios',
  },
  {
    title: 'Seguridad',
    description: 'Visitas QR, paquetería y registros de acceso.',
    href: '/seguridad',
  },
  {
    title: 'Configuración',
    description: 'Unidades, clusters, roles y notificaciones.',
    href: '/configuracion',
  },
];

export default function AdminHomePage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm font-medium text-teal-700">Panel administrativo</p>
            <h1 className="text-2xl font-bold text-slate-900">{APP_NAME}</h1>
          </div>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">
            MVP Setup
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Residencial Las Palmas</h2>
          <p className="mt-2 text-slate-600">
            Base lista para conectar Supabase, cargar unidades y comenzar el piloto con clientes
            reales.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <Stat label="Fondo operativo" value="$185,000" />
            <Stat label="Fondo de reserva" value="$420,000" />
            <Stat label="Unidades al día" value="85%" />
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {modules.map((module) => (
            <Link
              key={module.href}
              href={module.href}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-teal-300 hover:shadow-md"
            >
              <h3 className="text-lg font-semibold">{module.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{module.description}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
