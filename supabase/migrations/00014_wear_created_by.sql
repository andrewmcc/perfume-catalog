-- created_by is attribution: always the signed-in user on insert, never changed afterwards.
-- (Service-role inserts have no auth.uid() and keep whatever they set.)
create function private.wear_created_by() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      new.created_by := (select auth.uid());
    end if;
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;
revoke all on function private.wear_created_by() from public;
create trigger wears_created_by before insert or update on public.wears
  for each row execute function private.wear_created_by();
