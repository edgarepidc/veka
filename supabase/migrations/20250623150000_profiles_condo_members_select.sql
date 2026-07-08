-- Residents can read display names of other active members in the same condominium.

create policy "Members view profiles in shared condominiums"
on public.profiles for select
using (
  exists (
    select 1
    from public.memberships m_self
    join public.memberships m_other on m_other.condominium_id = m_self.condominium_id
    where m_self.user_id = auth.uid()
      and m_self.status = 'active'
      and m_other.user_id = profiles.id
      and m_other.status = 'active'
  )
);
