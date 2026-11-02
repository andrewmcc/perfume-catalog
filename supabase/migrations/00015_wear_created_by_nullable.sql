-- Deleting a user nulls created_by through the FK (an UPDATE); allow clearing, never reassigning.
create or replace function private.wear_created_by() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then
      new.created_by := (select auth.uid());
    end if;
  elsif new.created_by is not null then
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;
