-- A reviewer types a perfume by hand into a scan awaiting review (e.g. a set box read with no
-- scents, or a failed read), so review never depends on the AI. The typed values are stored as a
-- read identified from 'none', so approving never puts them in the shared catalogue.
create function public.add_manual_result(p_scan_id uuid, p_input jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_scan public.scans;
  v_in jsonb := case when jsonb_typeof(p_input) = 'object' then p_input else '{}'::jsonb end;
  v_house text := nullif(trim(v_in ->> 'house'), '');
  v_name text := nullif(trim(v_in ->> 'name'), '');
  v_conc text := nullif(trim(v_in ->> 'concentration'), '');
  v_flanker text := nullif(trim(v_in ->> 'flanker'), '');
  v_size numeric := case when jsonb_typeof(v_in -> 'size_ml') = 'number' and (v_in ->> 'size_ml')::numeric > 0 then (v_in ->> 'size_ml')::numeric end;
  v_id uuid;
begin
  select * into v_scan from public.scans s where s.id = p_scan_id for update;
  if not found or not private.is_member(v_scan.collection_id) or v_scan.status not in ('extracted', 'failed') then
    raise exception 'scan not awaiting review' using errcode = 'P0001';
  end if;
  if v_name is null then
    raise exception 'name required' using errcode = 'P0001';
  end if;
  if v_conc is not null and v_conc not in ('edc', 'edt', 'edp', 'parfum', 'extrait', 'cologne', 'other') then
    v_conc := null;
  end if;

  insert into public.scan_results (scan_id, collection_id, position, kind, read)
  values (
    v_scan.id,
    v_scan.collection_id,
    coalesce((select max(r.position) + 1 from public.scan_results r where r.scan_id = v_scan.id), 0),
    case v_scan.mode when 'bottle' then 'bottle' when 'samples' then 'vial' else 'set_scent' end,
    jsonb_build_object(
      'house', v_house,
      'name', v_name,
      'concentration', v_conc,
      'flanker_or_edition', v_flanker,
      'size_ml', v_size,
      'status', jsonb_build_object(
        'house', case when v_house is null then 'absent' else 'clear' end,
        'name', 'clear',
        'concentration', case when v_conc is null then 'absent' else 'clear' end),
      'alternatives', '[]'::jsonb,
      'identified_from', 'none')
  )
  returning id into v_id;

  update public.scans set status = 'extracted', error = null where id = v_scan.id and status = 'failed';
  return v_id;
end;
$$;
revoke execute on function public.add_manual_result(uuid, jsonb) from public, anon;
grant execute on function public.add_manual_result(uuid, jsonb) to authenticated;
