alter table public.collections enable row level security;
alter table public.collection_members enable row level security;
alter table public.perfumes enable row level security;
alter table public.sets enable row level security;
alter table public.items enable row level security;
alter table public.item_photos enable row level security;
alter table public.scans enable row level security;
alter table public.scan_results enable row level security;

-- All policies are for signed-in users; anon has no policy and so sees nothing.
-- Collections and membership are managed with the service role: members may only read.
create policy "collections member select" on public.collections for select to authenticated
  using (private.is_member(id));
create policy "collection_members member select" on public.collection_members for select to authenticated
  using (private.is_member(collection_id));

-- Shared catalogue rows (collection_id null) are readable by everyone signed in and written
-- only by the service role; collection rows are fully managed by members.
create policy "perfumes select" on public.perfumes for select to authenticated
  using (collection_id is null or private.is_member(collection_id));
create policy "perfumes member insert" on public.perfumes for insert to authenticated
  with check (collection_id is not null and private.is_member(collection_id));
create policy "perfumes member update" on public.perfumes for update to authenticated
  using (collection_id is not null and private.is_member(collection_id))
  with check (collection_id is not null and private.is_member(collection_id));
create policy "perfumes member delete" on public.perfumes for delete to authenticated
  using (collection_id is not null and private.is_member(collection_id));

create policy "sets member all" on public.sets for all to authenticated
  using (private.is_member(collection_id)) with check (private.is_member(collection_id));
create policy "items member all" on public.items for all to authenticated
  using (private.is_member(collection_id)) with check (private.is_member(collection_id));
create policy "item_photos member all" on public.item_photos for all to authenticated
  using (private.is_member(collection_id)) with check (private.is_member(collection_id));

-- Scans: members select and insert; pipeline state is written by the service role only.
create policy "scans member select" on public.scans for select to authenticated
  using (private.is_member(collection_id));
create policy "scans member insert" on public.scans for insert to authenticated
  with check (private.is_member(collection_id) and created_by = (select auth.uid()));

-- Clients may only create a scan with its upload columns (no update/delete at all).
revoke insert, update, delete on public.scans from authenticated, anon;
grant insert (id, collection_id, created_by, mode, photo_paths) on public.scans to authenticated;

create policy "scan_results member select" on public.scan_results for select to authenticated
  using (private.is_member(collection_id));
-- scan_results, collections and collection_members: no client write policies (service role only).
revoke insert, update, delete on public.scan_results, public.collections, public.collection_members from authenticated, anon;
