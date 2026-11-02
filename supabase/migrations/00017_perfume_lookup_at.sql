-- When "Look up notes" last ran for a perfume: at most one lookup per perfume per day (cost guard).
-- Written only by the service role (clients never write perfumes' shared columns).
alter table public.perfumes add column lookup_at timestamptz;
