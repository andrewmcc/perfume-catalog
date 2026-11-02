-- Ownership checks: foreign-key checks bypass RLS, so every reference from a client-writable
-- row must be proven to stay inside the row's own collection.

-- Composite-FK targets.
alter table public.sets add constraint sets_collection_id_id_key unique (collection_id, id);
alter table public.items add constraint items_collection_id_id_key unique (collection_id, id);
alter table public.scans add constraint scans_collection_id_id_key unique (collection_id, id);

-- items.set_id: same-collection set. MATCH SIMPLE skips the check when set_id is null; on set
-- delete only set_id is nulled (never collection_id, which is NOT NULL).
alter table public.items drop constraint items_set_id_fkey;
alter table public.items add constraint items_set_same_collection_fkey
  foreign key (collection_id, set_id) references public.sets (collection_id, id) on delete set null (set_id);

-- item_photos.item_id: same-collection item.
alter table public.item_photos drop constraint item_photos_item_id_fkey;
alter table public.item_photos add constraint item_photos_item_same_collection_fkey
  foreign key (collection_id, item_id) references public.items (collection_id, id) on delete cascade;

-- scan_results: same-collection scan and created item.
alter table public.scan_results drop constraint scan_results_scan_id_fkey;
alter table public.scan_results add constraint scan_results_scan_same_collection_fkey
  foreign key (collection_id, scan_id) references public.scans (collection_id, id) on delete cascade;
alter table public.scan_results drop constraint scan_results_created_item_id_fkey;
alter table public.scan_results add constraint scan_results_item_same_collection_fkey
  foreign key (collection_id, created_item_id) references public.items (collection_id, id) on delete set null (created_item_id);

-- Storage path prefixes.
alter table public.item_photos add constraint item_photos_path_prefix check (
  storage_path like collection_id::text || '/%'
  and (thumb_path is null or thumb_path like collection_id::text || '/%')
);

create function private.scan_paths_ok(cid uuid, sid uuid, paths text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(paths) between 1 and 2
    and not exists (
      select 1 from unnest(paths) p
      where p is null or p not like cid::text || '/' || sid::text || '/%'
    );
$$;
grant execute on function private.scan_paths_ok(uuid, uuid, text[]) to authenticated, service_role;
alter table public.scans add constraint scans_photo_paths_prefix check (private.scan_paths_ok(collection_id, id, photo_paths));

-- items.perfume_id: the perfume must be shared or belong to the item's own collection.
create function private.check_item_perfume() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.perfumes p
    where p.id = new.perfume_id and (p.collection_id is null or p.collection_id = new.collection_id)
  ) then
    raise exception 'perfume is not visible to this collection' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.check_item_perfume() from public;
create trigger items_check_perfume before insert or update of perfume_id, collection_id on public.items
  for each row execute function private.check_item_perfume();

-- Simplest guard: a perfume's collection_id cannot change at all while any item references it.
create function private.guard_perfume_collection() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.collection_id is distinct from old.collection_id
     and exists (select 1 from public.items i where i.perfume_id = old.id) then
    raise exception 'perfume is referenced by items; collection cannot change' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_perfume_collection() from public;
create trigger perfumes_guard_collection before update of collection_id on public.perfumes
  for each row execute function private.guard_perfume_collection();

-- Storage policies: compare as text so a non-uuid first segment is simply "not a member"
-- instead of raising 22P02.
create function private.is_member_text(seg text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collection_members m
    where m.collection_id::text = seg and m.user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_member_text(text) from public;
grant execute on function private.is_member_text(text) to authenticated, service_role;

drop policy "photos member select" on storage.objects;
drop policy "photos member insert" on storage.objects;
drop policy "photos member delete" on storage.objects;
create policy "photos member select" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and private.is_member_text((storage.foldername(name))[1]));
create policy "photos member insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and private.is_member_text((storage.foldername(name))[1]));
create policy "photos member delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and private.is_member_text((storage.foldername(name))[1]));

-- Stray non-unique column.
alter table public.collection_members drop column id;

comment on column public.perfumes.match_key is
  'Stored generated from normalise_name(house|name) + concentration. Any redefinition of normalise_name needs a backfill: update public.perfumes set house = house;';
