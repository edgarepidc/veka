'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatCurrency, paymentStatusLabel } from '@veka/shared';

import { createClient } from '@/lib/supabase/client';

const DEMO_CONDO_ID = '22222222-2222-2222-2222-222222222222';

interface UnitOption {
  id: string;
  identifier: string;
}

interface PaymentRow {
  id: string;
  amount: number;
  status: string;
  proof_url: string | null;
  created_at: string;
  unit: { identifier: string } | null;
  charge: { concept: string } | null;
}

interface ChargeRow {
  id: string;
  concept: string;
  amount: number;
  due_date: string;
  status: string;
  unit: { identifier: string } | null;
}

interface ExpenseRow {
  id: string;
  concept: string;
  amount: number;
  category: string;
  expense_date: string;
}

export function FinanceDashboard() {
  const supabase = createClient();
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [charges, setCharges] = useState<ChargeRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCharge, setNewCharge] = useState({
    unitId: '',
    concept: 'Cuota de mantenimiento',
    amount: '3500',
    dueDate: '',
  });

  const load = useCallback(async () => {
    setLoading(true);

    const [unitsRes, chargesRes, paymentsRes, expensesRes] = await Promise.all([
      supabase
        .from('units')
        .select('id, identifier')
        .eq('condominium_id', DEMO_CONDO_ID)
        .order('identifier'),
      supabase
        .from('charges')
        .select('id, concept, amount, due_date, status, unit:units(identifier)')
        .eq('condominium_id', DEMO_CONDO_ID)
        .order('due_date', { ascending: false }),
      supabase
        .from('payments')
        .select(
          'id, amount, status, proof_url, created_at, unit:units(identifier), charge:charges(concept)',
        )
        .eq('condominium_id', DEMO_CONDO_ID)
        .order('created_at', { ascending: false }),
      supabase
        .from('expenses')
        .select('id, concept, amount, category, expense_date')
        .eq('condominium_id', DEMO_CONDO_ID)
        .order('expense_date', { ascending: false }),
    ]);

    setUnits((unitsRes.data as UnitOption[]) ?? []);
    setCharges((chargesRes.data as unknown as ChargeRow[]) ?? []);
    setPayments((paymentsRes.data as unknown as PaymentRow[]) ?? []);
    setExpenses((expensesRes.data as unknown as ExpenseRow[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createCharge(e: React.FormEvent) {
    e.preventDefault();
    if (!newCharge.unitId || !newCharge.dueDate) return;

    const { error } = await supabase.from('charges').insert({
      condominium_id: DEMO_CONDO_ID,
      unit_id: newCharge.unitId,
      concept: newCharge.concept,
      amount: Number(newCharge.amount),
      due_date: newCharge.dueDate,
      status: 'pending',
      fund_type: 'operating',
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewCharge((prev) => ({ ...prev, concept: 'Cuota de mantenimiento', amount: '3500' }));
    void load();
  }

  async function reviewPayment(id: string, action: 'approve' | 'reject') {
    const res = await fetch(`/api/payments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error ?? 'Error al procesar pago');
      return;
    }

    void load();
  }

  if (loading) {
    return <p className="p-8 text-slate-600">Cargando finanzas…</p>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-sm text-teal-700">Finanzas</p>
            <h1 className="text-2xl font-bold">Gestión financiera</h1>
          </div>
          <Link href="/" className="text-sm font-medium text-teal-700 hover:underline">
            ← Panel
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Nueva cuota</h2>
          <form onSubmit={createCharge} className="mt-4 space-y-3">
            <select
              required
              value={newCharge.unitId}
              onChange={(e) => setNewCharge((p) => ({ ...p, unitId: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            >
              <option value="">Selecciona unidad</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.identifier}
                </option>
              ))}
            </select>
            <input
              required
              value={newCharge.concept}
              onChange={(e) => setNewCharge((p) => ({ ...p, concept: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Concepto"
            />
            <input
              required
              type="number"
              min="0"
              step="0.01"
              value={newCharge.amount}
              onChange={(e) => setNewCharge((p) => ({ ...p, amount: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              placeholder="Monto"
            />
            <input
              required
              type="date"
              value={newCharge.dueDate}
              onChange={(e) => setNewCharge((p) => ({ ...p, dueDate: e.target.value }))}
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
            />
            <button
              type="submit"
              className="rounded-xl bg-teal-700 px-4 py-2 font-semibold text-white hover:bg-teal-800"
            >
              Crear cuota
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Pagos por revisar</h2>
          <div className="mt-4 space-y-3">
            {payments.filter((p) => p.status === 'pending_review').length === 0 ? (
              <p className="text-sm text-slate-500">No hay comprobantes pendientes.</p>
            ) : (
              payments
                .filter((p) => p.status === 'pending_review')
                .map((payment) => (
                  <div key={payment.id} className="rounded-xl border border-slate-200 p-4">
                    <p className="font-medium">
                      {payment.unit?.identifier} · {formatCurrency(Number(payment.amount))}
                    </p>
                    <p className="text-sm text-slate-600">{payment.charge?.concept}</p>
                    {payment.proof_url ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const { data } = await supabase.storage
                            .from('payment-proofs')
                            .createSignedUrl(payment.proof_url!, 3600);
                          if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                        }}
                        className="mt-2 inline-block text-sm text-teal-700 hover:underline"
                      >
                        Ver comprobante
                      </button>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => reviewPayment(payment.id, 'approve')}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white"
                      >
                        Aprobar
                      </button>
                      <button
                        onClick={() => reviewPayment(payment.id, 'reject')}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold">Cargos activos</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2">Unidad</th>
                  <th className="py-2">Concepto</th>
                  <th className="py-2">Monto</th>
                  <th className="py-2">Vence</th>
                  <th className="py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {charges.map((charge) => (
                  <tr key={charge.id} className="border-b border-slate-100">
                    <td className="py-2">{charge.unit?.identifier}</td>
                    <td className="py-2">{charge.concept}</td>
                    <td className="py-2">{formatCurrency(Number(charge.amount))}</td>
                    <td className="py-2">{charge.due_date}</td>
                    <td className="py-2 capitalize">{charge.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold">Egresos del condominio</h2>
          <ul className="mt-4 space-y-2">
            {expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3"
              >
                <div>
                  <p className="font-medium">{expense.concept}</p>
                  <p className="text-sm text-slate-500">
                    {expense.category} · {expense.expense_date}
                  </p>
                </div>
                <span className="font-semibold">{formatCurrency(Number(expense.amount))}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h2 className="text-lg font-semibold">Historial de pagos</h2>
          <ul className="mt-4 space-y-2">
            {payments.map((payment) => (
              <li
                key={payment.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3 text-sm"
              >
                <span>
                  {payment.unit?.identifier} · {payment.charge?.concept}
                </span>
                <span>
                  {formatCurrency(Number(payment.amount))} ·{' '}
                  {paymentStatusLabel(payment.status as 'pending_review' | 'approved' | 'rejected')}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
