import Link from 'next/link';

export default function SeguridadPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-teal-700">Módulo en construcción</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Seguridad</h1>
        <p className="mt-4 text-slate-600">
          Visitas con QR, paquetería, check-in de guardia y historial de accesos.
        </p>
        <Link href="/" className="mt-8 inline-block text-sm font-medium text-teal-700 hover:underline">
          ← Volver al panel
        </Link>
      </div>
    </div>
  );
}
