-- Rename a perfume for the caller's collection. Shared rows are never edited:
--   private to the collection → renamed in place;
--   shared → the collection gets its own copy under the new name, and its items and wears move to it;
--   the new name is a perfume the collection can already see → items and wears move to that one (merge).
-- Returns the perfume id the collection now uses.
create function public.rename_perfume(p_perfume uuid, p_house text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_house text := nullif(trim(p_house), '');
  v_name text := nullif(trim(p_name), '');
  v_cid uuid;
  v_p public.perfumes;
  v_target uuid;
  v_sources jsonb;
begin
  if v_house is null or v_name is null or char_length(v_house) > 80 or char_length(v_name) > 80 then
    raise exception 'house and name required' using errcode = 'P0001';
  end if;
  -- The caller's collection that has this perfume.
  select i.collection_id into v_cid
    from public.items i
   where i.perfume_id = p_perfume and private.is_member(i.collection_id)
   limit 1;
  if v_cid is null then
    raise exception 'not found' using errcode = 'P0001';
  end if;
  select * into v_p from public.perfumes where id = p_perfume;
  perform pg_advisory_xact_lock(hashtextextended(v_cid::text || '|rename', 0));

  v_target := public.find_perfume(v_cid, v_house, v_name, v_p.concentration, v_p.flanker);
  if v_target = p_perfume then
    v_target := null; -- same identity (a case or accent change): rename in place below
  end if;

  if v_target is null and v_p.collection_id = v_cid then
    v_sources := coalesce(v_p.sources, '{}'::jsonb) || jsonb_build_object('house', 'edited', 'name', 'edited');
    update public.perfumes set house = v_house, name = v_name, sources = v_sources where id = p_perfume;
    return p_perfume;
  end if;

  if v_target is null then
    v_sources := coalesce(v_p.sources, '{}'::jsonb) || jsonb_build_object('house', 'edited', 'name', 'edited');
    insert into public.perfumes (
      collection_id, house, name, concentration, flanker, perfumers, release_year, house_type,
      family, subfamily, accords, notes_top, notes_heart, notes_base, longevity, sillage,
      seasons, times_of_day, occasions, gender_marketing, discontinued, reformulated,
      typical_price_per_ml, sources
    )
    select v_cid, v_house, v_name, p.concentration, p.flanker, p.perfumers, p.release_year, p.house_type,
           p.family, p.subfamily, p.accords, p.notes_top, p.notes_heart, p.notes_base, p.longevity, p.sillage,
           p.seasons, p.times_of_day, p.occasions, p.gender_marketing, p.discontinued, p.reformulated,
           p.typical_price_per_ml, v_sources
      from public.perfumes p where p.id = p_perfume
    returning id into v_target;
  end if;

  update public.items set perfume_id = v_target where collection_id = v_cid and perfume_id = p_perfume;
  -- The wear trigger takes perfume_id from the (moved) item.
  update public.wears set perfume_id = v_target where collection_id = v_cid and perfume_id = p_perfume and item_id is not null;
  -- A private perfume left with nothing pointing at it goes.
  delete from public.perfumes p
   where p.id = p_perfume and p.collection_id = v_cid
     and not exists (select 1 from public.items i where i.perfume_id = p.id)
     and not exists (select 1 from public.wears w where w.perfume_id = p.id);
  return v_target;
end;
$$;
revoke execute on function public.rename_perfume(uuid, text, text) from public, anon;
grant execute on function public.rename_perfume(uuid, text, text) to authenticated;
