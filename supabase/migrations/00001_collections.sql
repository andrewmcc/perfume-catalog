-- Collections are the unit of sharing: every user-owned row belongs to a collection and
-- every member of a collection sees all of it. Membership is managed with the service role.
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null
);

create table public.collection_members (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  primary key (collection_id, user_id)
);
create index collection_members_user_idx on public.collection_members (user_id);

-- Policies call this instead of subquerying collection_members, which would recurse through
-- that table's own RLS. Security definer + empty search_path, executable by signed-in users only.
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create function private.is_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collection_members m
    where m.collection_id = cid and m.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_member(uuid) from public;
grant execute on function private.is_member(uuid) to authenticated, service_role;
