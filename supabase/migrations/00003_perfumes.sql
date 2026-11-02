-- Perfume catalogue. collection_id null = shared catalogue row (written by the service role
-- only); otherwise the row is private to that collection.
create table public.perfumes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  collection_id uuid references public.collections (id) on delete cascade,

  -- identity
  house text not null,
  name text not null,
  concentration text check (concentration in ('edc', 'edt', 'edp', 'parfum', 'extrait', 'cologne', 'other')),
  flanker text,
  perfumers text[] not null default '{}',
  release_year smallint,
  house_type text check (house_type in ('designer', 'niche', 'indie', 'celebrity', 'other')),

  -- scent
  family text,
  subfamily text,
  accords text[] not null default '{}',
  notes_top text[] not null default '{}',
  notes_heart text[] not null default '{}',
  notes_base text[] not null default '{}',

  -- wear and performance
  longevity text check (longevity in ('short', 'moderate', 'long', 'very_long')),
  sillage text check (sillage in ('intimate', 'moderate', 'strong', 'enormous')),
  seasons text[] not null default '{}',
  times_of_day text[] not null default '{}',
  occasions text[] not null default '{}',
  gender_marketing text check (gender_marketing in ('feminine', 'masculine', 'unisex')),

  -- status and price
  discontinued boolean,
  reformulated boolean,
  typical_price_per_ml numeric,

  -- provenance: field -> 'label' | 'ai' | 'text'
  sources jsonb not null default '{}',

  -- matching
  match_key text generated always as (
    public.normalise_name(house) || '|' || public.normalise_name(name) || '|' || coalesce(concentration, '')
  ) stored
);

create unique index perfumes_shared_match_key on public.perfumes (match_key) where collection_id is null;
create unique index perfumes_collection_match_key on public.perfumes (collection_id, match_key) where collection_id is not null;
