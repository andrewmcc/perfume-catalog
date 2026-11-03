-- "Tried": smelled in a shop or on a strip, never owned and not wished for.
alter table public.items drop constraint items_status_check;
alter table public.items add constraint items_status_check check (status in ('owned', 'wishlist', 'gone', 'tried'));
