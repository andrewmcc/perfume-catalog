-- A perfume enters the shared catalogue only when no identity field was edited in review
-- (00010 only checked house and name). Concentration values are limited by perfumes' check.

create or replace function public.approve_result(p_result_id uuid, p_input jsonb)
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

  -- Perfume. Shared only when every identity field (house, name, concentration, flanker) came
  -- unedited from a label.
  v_perfume := public.find_perfume(v_scan.collection_id, v_house, v_name, v_conc);
  if v_perfume is null then
    v_shared := cardinality(v_edited) = 0 and coalesce(v_read ->> 'identified_from', '') in ('label', 'both');
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
