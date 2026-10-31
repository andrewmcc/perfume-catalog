-- Strict, whole-path-anchored photo paths (no "..", no extra segments) and a row lock in the
-- item/perfume check.

create or replace function private.scan_paths_ok(cid uuid, sid uuid, paths text[]) returns boolean
language sql immutable set search_path = '' as $$
  select cardinality(paths) between 1 and 2
    and not exists (
      select 1 from unnest(paths) p
      where p is null or p !~ ('^' || cid::text || '/' || sid::text || '/photo-[12]\.jpg$')
    );
$$;

alter table public.item_photos drop constraint item_photos_path_prefix;
alter table public.item_photos add constraint item_photos_path_strict check (
  storage_path ~ ('^' || collection_id::text || '/[0-9a-f-]{36}/[A-Za-z0-9_-]+\.(jpg|webp)$')
  and (thumb_path is null or thumb_path ~ ('^' || collection_id::text || '/[0-9a-f-]{36}/[A-Za-z0-9_-]+\.(jpg|webp)$'))
);

-- FOR SHARE: a concurrent change of the perfume's collection_id must wait for this
-- transaction, and the guard trigger then sees the referencing item.
create or replace function private.check_item_perfume() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.perfumes p
    where p.id = new.perfume_id and (p.collection_id is null or p.collection_id = new.collection_id)
    for share
  ) then
    raise exception 'perfume is not visible to this collection' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop policy "photos member insert" on storage.objects;
create policy "photos member insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'photos'
    and name not like '%..%' and name not like '%//%'
    and private.is_member_text((storage.foldername(name))[1])
  );
