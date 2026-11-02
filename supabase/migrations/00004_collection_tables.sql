create function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  house text,
  name text,
  notes text
);
create index sets_collection_idx on public.sets (collection_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  perfume_id uuid not null references public.perfumes (id),
  set_id uuid references public.sets (id) on delete set null,
  format text not null default 'full' check (format in ('full', 'travel', 'decant', 'sample')),
  size_ml numeric,
  status text not null default 'owned' check (status in ('owned', 'wishlist', 'gone')),
  purchase_price numeric,
  purchase_currency text not null default 'GBP',
  purchased_on date,
  purchase_source text,
  batch_code text,
  notes text,
  overrides jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
create index items_collection_idx on public.items (collection_id);
create index items_perfume_idx on public.items (perfume_id);
create index items_set_idx on public.items (set_id);
create trigger items_set_updated_at before update on public.items
  for each row execute function public.set_updated_at();

create table public.item_photos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  item_id uuid not null references public.items (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  storage_path text not null,
  thumb_path text,
  width int,
  height int,
  position smallint not null default 0
);
create index item_photos_item_idx on public.item_photos (item_id);
create index item_photos_collection_idx on public.item_photos (collection_id);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  mode text not null check (mode in ('bottle', 'samples', 'set')),
  photo_paths text[] not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'processing', 'extracted', 'failed', 'reviewed')),
  extraction jsonb,
  model text,
  error text,
  attempts smallint not null default 0,
  updated_at timestamptz not null default now()
);
create index scans_collection_idx on public.scans (collection_id);
create trigger scans_set_updated_at before update on public.scans
  for each row execute function public.set_updated_at();

create table public.scan_results (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  scan_id uuid not null references public.scans (id) on delete cascade,
  collection_id uuid not null references public.collections (id) on delete cascade,
  position smallint not null,
  kind text not null check (kind in ('bottle', 'vial', 'set_scent')),
  read jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'discarded')),
  created_item_id uuid references public.items (id) on delete set null
);
create index scan_results_scan_idx on public.scan_results (scan_id);
create index scan_results_collection_idx on public.scan_results (collection_id);
