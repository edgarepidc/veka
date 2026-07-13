-- Friendlier comment notification copy and remove stale test notifications.

create or replace function public.community_comment_author_label(p_author_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(nullif(trim(full_name), ''), 'Un residente')
  from public.profiles
  where id = p_author_id;
$$;

grant execute on function public.community_comment_author_label(uuid) to authenticated;

create or replace function public.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post record;
  v_parent_author_id uuid;
  v_author_name text;
  v_post_title text;
  v_reply_preview text;
begin
  select p.id, p.condominium_id, p.title, p.is_pinned, p.author_id
  into v_post
  from public.posts p
  where p.id = new.post_id;

  if not found then
    return new;
  end if;

  v_author_name := public.community_comment_author_label(new.author_id);
  v_post_title := left(trim(v_post.title), 100);
  v_reply_preview := left(trim(new.body), 100);

  if new.parent_id is not null then
    select c.author_id
    into v_parent_author_id
    from public.post_comments c
    where c.id = new.parent_id;

    if v_parent_author_id is not null and v_parent_author_id <> new.author_id then
      insert into public.user_notifications (
        condominium_id,
        user_id,
        notification_type,
        title,
        body,
        entity_type,
        entity_id,
        comment_id
      )
      values (
        v_post.condominium_id,
        v_parent_author_id,
        'community_comment_reply',
        'Respondieron a tu comentario',
        v_author_name || ' en «' || v_post_title || '»: «' || v_reply_preview || '»',
        'post',
        v_post.id,
        new.id
      );
    end if;
  elsif v_post.author_id <> new.author_id then
    insert into public.user_notifications (
      condominium_id,
      user_id,
      notification_type,
      title,
      body,
      entity_type,
      entity_id,
      comment_id
    )
    values (
      v_post.condominium_id,
      v_post.author_id,
      'community_post_comment',
      'Comentario en tu aviso',
      v_author_name || ': «' || v_reply_preview || '»',
      'post',
      v_post.id,
      new.id
    );
  end if;

  if v_post.is_pinned then
    insert into public.user_notifications (
      condominium_id,
      user_id,
      notification_type,
      title,
      body,
      entity_type,
      entity_id,
      comment_id
    )
    select
      v_post.condominium_id,
      m.user_id,
      'community_comment',
      'Nuevo comentario en aviso fijado',
      v_author_name || ' comentó en «' || v_post_title || '»',
      'post',
      v_post.id,
      new.id
    from public.memberships m
    where m.condominium_id = v_post.condominium_id
      and m.status = 'active'
      and m.user_id <> new.author_id
      and (
        v_parent_author_id is null
        or m.user_id <> v_parent_author_id
      )
      and (
        new.parent_id is not null
        or m.user_id <> v_post.author_id
      );
  end if;

  return new;
end;
$$;

delete from public.user_notifications
where body ilike '%test comment from script%'
   or body ilike '%rls test comment%'
   or body ilike '%api test%';

notify pgrst, 'reload schema';
