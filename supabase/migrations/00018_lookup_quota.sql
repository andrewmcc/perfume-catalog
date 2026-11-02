-- Replaces perfumes.lookup_at (members can update their private perfumes, and create new ones):
-- a lookup log only the service role touches, with a per-perfume daily cooldown and a
-- per-collection daily cap, claimed atomically.
alter table public.perfumes drop column lookup_at;

create table private.enrich_lookups (
  id bigint generated always as identity primary key,
  collection_id uuid not null references public.collections (id) on delete cascade,
  perfume_id uuid not null references public.perfumes (id) on delete cascade,
  created_at timestamptz not null
);
create index enrich_lookups_collection_idx on private.enrich_lookups (collection_id, created_at);
create index enrich_lookups_perfume_idx on private.enrich_lookups (perfume_id, created_at);
revoke all on private.enrich_lookups from public, authenticated, anon;

create function public.claim_lookup(p_collection uuid, p_perfume uuid, p_now timestamptz default now(), p_daily_cap int default 20)
returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  -- Serialise claims per collection so parallel taps can't both pass the checks.
  perform pg_advisory_xact_lock(hashtextextended(p_collection::text, 0));
  if exists (select 1 from private.enrich_lookups l where l.perfume_id = p_perfume and l.created_at > p_now - interval '1 day' and l.created_at <= p_now) then
    return false;
  end if;
  if (select count(*) from private.enrich_lookups l where l.collection_id = p_collection and l.created_at > p_now - interval '1 day' and l.created_at <= p_now) >= p_daily_cap then
    return false;
  end if;
  insert into private.enrich_lookups (collection_id, perfume_id, created_at) values (p_collection, p_perfume, p_now);
  return true;
end;
$$;
revoke all on function public.claim_lookup(uuid, uuid, timestamptz, int) from public, anon, authenticated;
grant execute on function public.claim_lookup(uuid, uuid, timestamptz, int) to service_role;
