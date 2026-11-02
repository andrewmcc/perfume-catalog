-- Members can't clear created_by either: only a non-user request (the FK action when a user is
-- deleted runs as the service role) or a created_by whose user no longer exists may be nulled.
create or replace function private.wear_created_by() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      new.created_by := (select auth.uid());
    end if;
  elsif new.created_by is null
    and ((select auth.uid()) is null or not exists (select 1 from auth.users u where u.id = old.created_by)) then
    null;
  else
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;
