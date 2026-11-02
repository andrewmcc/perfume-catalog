-- Phase 1c: review. Perfume matching, approval of a scan result into an item (creating the
-- perfume and, in set mode, the set), discard/dismiss, and re-read of extracted scans.

-- The set a set-mode scan created, so every approved scent links to the same one.
alter table public.scans add column created_set_id uuid;
alter table public.scans add constraint scans_created_set_same_collection_fkey
  foreign key (collection_id, created_set_id) references public.sets (collection_id, id) on delete set null (created_set_id);

-- Finds the perfume a read refers to, among shared rows and the collection's own rows.
--   with a concentration: exact match_key, or the same house|name with no concentration
--   without one:          any concentration of that house|name
-- Prefers an exact concentration, then the collection's own row, then the oldest.
-- normalise_name leaves only alphanumerics and spaces, so LIKE sees no wildcards.
create function public.find_perfume(p_collection uuid, p_house text, p_name text, p_conc text) returns uuid
language sql stable set search_path = '' as $$
  with k as (
    select public.normalise_name(p_house) || '|' || public.normalise_name(p_name) || '|' as hn,
           nullif(trim(coalesce(p_conc, '')), '') as conc
  )
  select p.id
    from public.perfumes p, k
   where (p.collection_id is null or p.collection_id = p_collection)
     and case
           when k.conc is not null then p.match_key = k.hn || k.conc or p.match_key = k.hn
           else p.match_key like k.hn || '%'
         end
   order by (p.concentration is not distinct from k.conc) desc, (p.collection_id is not null) desc, p.created_at
   limit 1;
$$;
revoke execute on function public.find_perfume(uuid, text, text, text) from public, anon;
grant execute on function public.find_perfume(uuid, text, text, text) to authenticated, service_role;

-- Review flags for the caller's pending results (RLS confines rows to their collections).
create function public.review_lookup(p_scan_ids uuid[]) returns table(result_id uuid, perfume_id uuid, duplicate boolean)
language sql stable security invoker set search_path = '' as $$
  select r.id,
         f.pid,
         exists (select 1 from public.items i
                  where i.collection_id = r.collection_id and i.perfume_id = f.pid and i.status = 'owned')
    from public.scan_results r
   cross join lateral (
     select public.find_perfume(r.collection_id, r.read ->> 'house', r.read ->> 'name', r.read ->> 'concentration') as pid
   ) f
   where r.scan_id = any (p_scan_ids) and r.status = 'pending';
$$;
revoke execute on function public.review_lookup(uuid[]) from public, anon;
grant execute on function public.review_lookup(uuid[]) to authenticated;

-- Marks the scan reviewed once nothing is pending.
create function private.review_if_done(p_scan_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.scans s set status = 'reviewed'
   where s.id = p_scan_id
     and not exists (select 1 from public.scan_results r where r.scan_id = p_scan_id and r.status = 'pending');
$$;
revoke all on function private.review_if_done(uuid) from public;

-- Locks the scan behind a result, then the result; raises unless the caller is a member and
-- the result is pending. Returns the scan id.
create function private.lock_pending_result(p_result_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_scan_id uuid;
  v_cid uuid;
  v_status text;
begin
  select r.scan_id into v_scan_id from public.scan_results r where r.id = p_result_id;
  if v_scan_id is not null then
    select s.collection_id into v_cid from public.scans s where s.id = v_scan_id for update;
  end if;
  if v_cid is null or not private.is_member(v_cid) then
    raise exception 'result not pending' using errcode = 'P0001';
  end if;
  select r.status into v_status from public.scan_results r where r.id = p_result_id for update;
  if v_status <> 'pending' then
    raise exception 'result not pending' using errcode = 'P0001';
  end if;
  return v_scan_id;
end;
$$;
revoke all on function private.lock_pending_result(uuid) from public;

-- Approves one result (p_input's edited_fields key is ignored): matches or creates the perfume, creates the set once per set-mode scan,
-- then the item and its photos. Only the keys below are read from p_input; anything else
-- (collection, perfume, paths, status) comes from the scan row.
create function public.approve_result(p_result_id uuid, p_input jsonb)
returns table(item_id uuid, created_perfume_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_scan_id uuid;
  v_scan public.scans;
  v_res public.scan_results;
  v_in jsonb := case when jsonb_typeof(p_input) = 'object' then p_input else '{}'::jsonb end;
  v_read jsonb;
  v_ext jsonb;
  v_edited text[];
  v_house text;
  v_name text;
  v_conc text;
  v_flanker text;
  v_size numeric;
  v_format text;
  v_batch text;
  v_shared boolean;
  v_sources jsonb := '{}'::jsonb;
  v_perfume uuid;
  v_created uuid;
  v_set uuid;
  v_item uuid;
  v_path text;
  v_thumb text;
  v_pos smallint := 0;
begin
  v_scan_id := private.lock_pending_result(p_result_id);
  select * into v_scan from public.scans s where s.id = v_scan_id;
  select * into v_res from public.scan_results r where r.id = p_result_id;
  v_read := v_res.read;
  v_ext := coalesce(v_scan.extraction, '{}'::jsonb);
  -- Edited fields are derived here (input vs. the read), never trusted from the client: they
  -- decide whether the perfume may enter the shared catalogue.
  v_edited := array(
    select f from unnest(array['house', 'name', 'concentration', 'flanker']) f
     where v_in ? f
       and nullif(trim(v_in ->> f), '') is distinct from
           nullif(trim(v_read ->> case f when 'flanker' then 'flanker_or_edition' else f end), '')
  );

  v_house := nullif(trim(case when v_in ? 'house' then v_in ->> 'house' else v_read ->> 'house' end), '');
  v_name := nullif(trim(case when v_in ? 'name' then v_in ->> 'name' else v_read ->> 'name' end), '');
  v_conc := nullif(trim(case when v_in ? 'concentration' then v_in ->> 'concentration' else v_read ->> 'concentration' end), '');
  v_flanker := nullif(trim(case when v_in ? 'flanker' then v_in ->> 'flanker' else v_read ->> 'flanker_or_edition' end), '');
  v_size := nullif(case when v_in ? 'size_ml' then v_in ->> 'size_ml' else v_read ->> 'size_ml' end, '')::numeric;
  if v_house is null or v_name is null then
    raise exception 'house and name required' using errcode = 'P0001';
  end if;

  if v_res.kind = 'bottle' then
    v_format := coalesce(nullif(case when v_in ? 'format' then v_in ->> 'format' else v_ext ->> 'format' end, ''), 'full');
    v_batch := nullif(trim(case when v_in ? 'batch_code' then v_in ->> 'batch_code' else v_ext ->> 'batch_code' end), '');
  else
    v_format := 'sample';
  end if;

  -- Perfume. Shared only when the identity came unedited from a label.
  v_perfume := public.find_perfume(v_scan.collection_id, v_house, v_name, v_conc);
  if v_perfume is null then
    v_shared := not (v_edited && array['house', 'name']) and coalesce(v_read ->> 'identified_from', '') in ('label', 'both');
    select coalesce(jsonb_object_agg(f, case when f = any (v_edited) then 'edited' else 'label' end), '{}'::jsonb)
      into v_sources
      from unnest(array['house', 'name', 'concentration', 'flanker']) f
     where case f when 'concentration' then v_conc is not null when 'flanker' then v_flanker is not null else true end;
    if v_shared then
      insert into public.perfumes (collection_id, house, name, concentration, flanker, sources)
      values (null, v_house, v_name, v_conc, v_flanker, v_sources)
      on conflict (match_key) where collection_id is null do nothing
      returning id into v_created;
    else
      insert into public.perfumes (collection_id, house, name, concentration, flanker, sources)
      values (v_scan.collection_id, v_house, v_name, v_conc, v_flanker, v_sources)
      on conflict (collection_id, match_key) where collection_id is not null do nothing
      returning id into v_created;
    end if;
    v_perfume := coalesce(v_created, public.find_perfume(v_scan.collection_id, v_house, v_name, v_conc));
  end if;

  -- Set, once per scan (the scan row lock serialises concurrent approvals).
  if v_scan.mode = 'set' then
    v_set := v_scan.created_set_id;
    if v_set is null then
      insert into public.sets (collection_id, house, name)
      values (
        v_scan.collection_id,
        nullif(trim(case when v_in ? 'set_house' then v_in ->> 'set_house' else v_ext ->> 'set_house' end), ''),
        nullif(trim(case when v_in ? 'set_name' then v_in ->> 'set_name' else v_ext ->> 'set_name' end), '')
      )
      returning id into v_set;
      update public.scans set created_set_id = v_set where id = v_scan.id;
    end if;
  end if;

  insert into public.items (collection_id, perfume_id, set_id, format, size_ml, batch_code, status)
  values (v_scan.collection_id, v_perfume, v_set, v_format, v_size, v_batch, 'owned')
  returning id into v_item;

  foreach v_path in array v_scan.photo_paths loop
    v_thumb := regexp_replace(v_path, 'photo-([12])\.jpg$', 'thumb-\1.jpg');
    if not exists (select 1 from storage.objects o where o.bucket_id = 'photos' and o.name = v_thumb) then
      v_thumb := null;
    end if;
    insert into public.item_photos (item_id, collection_id, storage_path, thumb_path, position)
    values (v_item, v_scan.collection_id, v_path, v_thumb, v_pos);
    v_pos := v_pos + 1;
  end loop;

  update public.scan_results set status = 'approved', created_item_id = v_item where id = v_res.id;
  perform private.review_if_done(v_scan.id);

  return query select v_item, v_created;
end;
$$;
revoke execute on function public.approve_result(uuid, jsonb) from public, anon;
grant execute on function public.approve_result(uuid, jsonb) to authenticated;

create function public.discard_result(p_result_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_scan_id uuid;
  v_scan public.scans;
  v_res public.scan_results;
begin
  v_scan_id := private.lock_pending_result(p_result_id);
  select * into v_scan from public.scans s where s.id = v_scan_id;
  select * into v_res from public.scan_results r where r.id = p_result_id;
  update public.scan_results set status = 'discarded' where id = v_res.id;
  perform private.review_if_done(v_scan.id);
end;
$$;
revoke execute on function public.discard_result(uuid) from public, anon;
grant execute on function public.discard_result(uuid) to authenticated;

-- Closes a scan from review: its pending results are discarded and it is marked reviewed.
create function public.dismiss_scan(p_scan_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_scan public.scans;
begin
  select * into v_scan from public.scans s where s.id = p_scan_id for update;
  if not found or not private.is_member(v_scan.collection_id) or v_scan.status not in ('extracted', 'failed') then
    raise exception 'scan not awaiting review' using errcode = 'P0001';
  end if;
  update public.scan_results set status = 'discarded' where scan_id = p_scan_id and status = 'pending';
  update public.scans set status = 'reviewed' where id = p_scan_id;
end;
$$;
revoke execute on function public.dismiss_scan(uuid) from public, anon;
grant execute on function public.dismiss_scan(uuid) to authenticated;

-- Re-read: an explicit claim may also take an extracted scan.
create or replace function public.claim_scan(p_id uuid, p_claim text) returns setof public.scans
language sql security invoker set search_path = '' as $$
  update public.scans
     set status = 'processing', attempts = attempts + 1, error = null
   where id = p_id
     and (
       (p_claim = 'explicit' and (status in ('uploaded', 'failed', 'extracted')
                                  or (status = 'processing' and updated_at < now() - interval '10 minutes')))
       or
       (p_claim = 'sweep' and ((status = 'uploaded' and updated_at < now() - interval '2 minutes')
                               or (status = 'processing' and updated_at < now() - interval '10 minutes')))
     )
  returning *;
$$;
