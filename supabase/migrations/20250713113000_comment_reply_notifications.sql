-- Comment reply + post-author notifications, with comment deep-link target.

alter table public.user_notifications
  add column if not exists comment_id uuid references public.post_comments (id) on delete set null;

create index if not exists idx_user_notifications_comment
  on public.user_notifications (comment_id)
  where comment_id is not null;

alter table public.user_notifications
  drop constraint if exists user_notifications_notification_type_check;

alter table public.user_notifications
  add constraint user_notifications_notification_type_check
  check (
    notification_type in (
      'community_poll',
      'community_poll_closed',
      'community_comment',
      'community_comment_reply',
      'community_post_comment',
      'community_announcement'
    )
  );

create or replace function public.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_post record;
  v_parent_author_id uuid;
begin
  select p.id, p.condominium_id, p.title, p.is_pinned, p.author_id
  into v_post
  from public.posts p
  where p.id = new.post_id;

  if not found then
    return new;
  end if;

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
        left(trim(new.body), 160),
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
      left(trim(new.body), 160),
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
      left(trim(new.body), 160),
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

drop trigger if exists trg_notify_pinned_post_comment on public.post_comments;

create trigger trg_notify_post_comment
after insert on public.post_comments
for each row
execute function public.notify_post_comment();

notify pgrst, 'reload schema';
