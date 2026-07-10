-- Fix infinite RLS recursion when inserting post_comments (parent lookup in policy).

create or replace function public.post_comment_insert_allowed(p_parent_id uuid, p_post_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_parent_id is null then true
    else exists (
      select 1
      from public.post_comments c
      where c.id = p_parent_id
        and c.post_id = p_post_id
    )
    and public.post_comment_can_reply(p_parent_id)
  end;
$$;

grant execute on function public.post_comment_insert_allowed(uuid, uuid) to authenticated;

drop policy if exists "Members comment on announcements" on public.post_comments;

create policy "Members comment on announcements"
on public.post_comments for insert
with check (
  author_id = auth.uid()
  and public.post_comment_insert_allowed(parent_id, post_id)
  and exists (
    select 1
    from public.posts p
    where p.id = post_id
      and p.post_type in ('announcement', 'photo')
      and public.is_member_of(p.condominium_id)
  )
);

notify pgrst, 'reload schema';
