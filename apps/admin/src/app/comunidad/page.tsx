import Link from 'next/link';

export default function ComunidadPage() {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-teal-700">Módulo en construcción</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Comunidad</h1>
        <p className="mt-4 text-slate-600">
          Feed, encuestas, documentos y moderación de contenido.
        </p>
        <Link href="/" className="mt-8 inline-block text-sm font-medium text-teal-700 hover:underline">
          ← Volver al panel
        </Link>
      </div>
    </div>
  );
}
