-- Wears (the diary) and per-collection settings (location for Today's weather).

create table public.wears (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  collection_id uuid not null references public.collections (id) on delete cascade,
  item_id uuid,
  perfume_id uuid not null references public.perfumes (id),
  worn_on date not null,
  time_of_day text check (time_of_day in ('day', 'evening', 'night')),
  rating smallint check (rating between 1 and 5),
  notes text check (char_length(notes) <= 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  -- Same-collection item; deleting the item keeps the wear (only item_id is nulled).
  constraint wears_item_same_collection_fkey foreign key (collection_id, item_id)
    references public.items (collection_id, id) on delete set null (item_id)
);
create index wears_collection_worn_on_idx on public.wears (collection_id, worn_on);
create index wears_perfume_idx on public.wears (perfume_id);
create index wears_item_idx on public.wears (item_id);
create trigger wears_set_updated_at before update on public.wears
  for each row execute function public.set_updated_at();

-- perfume_id is always the item's: clients can't point a wear at another perfume, and the
-- item must be in the wear's collection. A wear whose item was deleted keeps its perfume.
create function private.wear_from_item() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_perfume uuid;
begin
  if new.item_id is null then
    if tg_op = 'INSERT' then
      raise exception 'wear needs an item' using errcode = '23502';
    end if;
    if new.perfume_id is distinct from old.perfume_id or new.collection_id is distinct from old.collection_id then
      raise exception 'wear perfume cannot change' using errcode = '42501';
    end if;
    return new;
  end if;
  select i.perfume_id into v_perfume
  from public.items i
  where i.id = new.item_id and i.collection_id = new.collection_id;
  if v_perfume is null then
    raise exception 'item is not in this collection' using errcode = '42501';
  end if;
  new.perfume_id := v_perfume;
  return new;
end;
$$;
revoke all on function private.wear_from_item() from public;
create trigger wears_from_item before insert or update of item_id, perfume_id, collection_id on public.wears
  for each row execute function private.wear_from_item();

alter table public.wears enable row level security;
create policy "wears member all" on public.wears for all to authenticated
  using (private.is_member(collection_id)) with check (private.is_member(collection_id));

-- One row per collection. Coordinates are rounded to 2 dp (about 1 km); place is an outward code.
create table public.collection_settings (
  collection_id uuid primary key references public.collections (id) on delete cascade,
  lat numeric(5, 2) check (lat between -90 and 90),
  lon numeric(5, 2) check (lon between -180 and 180),
  place text check (char_length(place) <= 40),
  updated_at timestamptz not null default now()
);
create trigger collection_settings_set_updated_at before update on public.collection_settings
  for each row execute function public.set_updated_at();
alter table public.collection_settings enable row level security;
create policy "collection_settings member all" on public.collection_settings for all to authenticated
  using (private.is_member(collection_id)) with check (private.is_member(collection_id));
