import type { AssemblyRow } from '@/lib/load-assemblies';

export function AssemblyPublishSelect({
  assemblies,
  clusterId,
}: {
  assemblies: AssemblyRow[];
  clusterId: string;
}) {
  const options = assemblies.filter((assembly) => {
    if (!clusterId) return true;
    if (assembly.clusters.length === 0) return true;
    return assembly.clusters.some((cluster) => cluster.id === clusterId);
  });

  if (options.length === 0) return null;

  return (
    <label className="block text-sm text-muted">
      Vincular a asamblea (opcional)
      <select name="assembly_id" defaultValue="" className="glass-input mt-1 w-full">
        <option value="" className="bg-slate-900">
          Sin vincular
        </option>
        {options.map((assembly) => (
          <option key={assembly.id} value={assembly.id} className="bg-slate-900">
            {assembly.title}
            {assembly.scheduledAt
              ? ` · ${new Date(assembly.scheduledAt).toLocaleDateString('es-MX')}`
              : ''}
          </option>
        ))}
      </select>
      <span className="mt-1 block text-xs text-subtle">
        Si eliges una asamblea, el aviso o encuesta quedará en su expediente al publicarse.
      </span>
    </label>
  );
}
