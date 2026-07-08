-- Staff puede crear y editar actividades a demanda (fuera del calendario programado).

create policy "Staff insert on-demand routines"
on public.maintenance_routines for insert
with check (
  public.has_role(condominium_id, array['staff']::public.membership_role[])
  and recurrence = 'on_demand'
  and day_of_week is null
  and created_by = auth.uid()
);

create policy "Staff update own on-demand routines"
on public.maintenance_routines for update
using (
  recurrence = 'on_demand'
  and created_by = auth.uid()
  and public.has_role(condominium_id, array['staff']::public.membership_role[])
)
with check (
  recurrence = 'on_demand'
  and day_of_week is null
  and created_by = auth.uid()
  and public.has_role(condominium_id, array['staff']::public.membership_role[])
);
