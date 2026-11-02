-- Name normalisation used for match_key (copied from Seeds migration 00021, the latest
-- definition): strips case, punctuation and apostrophes; '+' reads as "plus"; a name that
-- strips to nothing keeps its trimmed text.
create or replace function public.normalise_name(p_text text) returns text
language sql immutable set search_path = '' as $$
  select case
    when s.stripped <> '' then s.stripped
    else lower(trim(coalesce(p_text, '')))
  end
  from (
    select trim(regexp_replace(lower(translate(replace(coalesce(p_text, ''), '+', ' plus '), '''’‘`´', '')), '[^[:alnum:]]+', ' ', 'g')) as stripped
  ) s;
$$;
