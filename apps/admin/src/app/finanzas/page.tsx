export default function FinanzasPage() {
  return (
    <PlaceholderPage
      title="Finanzas"
      description="Gestión de cuotas, validación de comprobantes, egresos con evidencia y reportes de transparencia."
    />
  );
}

function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-teal-700">Módulo en construcción</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-4 text-slate-600">{description}</p>
        <a href="/" className="mt-8 inline-block text-sm font-medium text-teal-700 hover:underline">
          ← Volver al panel
        </a>
      </div>
    </div>
  );
}
