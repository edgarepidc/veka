-- Treat legacy "closed" tickets as resolved (closed ≈ resolved in product).

update public.maintenance_tickets
set status = 'resolved',
    resolved_at = coalesce(resolved_at, now())
where status = 'closed';
