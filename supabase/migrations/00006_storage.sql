-- Private photo bucket. Objects live at {collection_id}/{...}; the first path segment must be
-- a collection the caller belongs to. JPEG/WebP only, 10 MB max.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 10485760, array['image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "photos member select" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy "photos member insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy "photos member delete" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and private.is_member(((storage.foldername(name))[1])::uuid));
