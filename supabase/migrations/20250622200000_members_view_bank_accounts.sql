-- Residents can read active bank accounts for transfer instructions (CLABE, bank name).
create policy "Members view active bank accounts"
on public.bank_accounts for select
using (public.is_member_of(condominium_id) and is_active = true);
