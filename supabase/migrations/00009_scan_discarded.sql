-- Phase 1b: 'discarded' scans (not perfume), an index for the pending sweep, and an atomic claim.

alter table public.scans drop constraint scans_status_check;
alter table public.scans add constraint scans_status_check
  check (status in ('uploaded', 'processing', 'extracted', 'failed', 'discarded', 'reviewed'));

create index scans_pending_idx on public.scans (collection_id, status, updated_at);

-- Claims a scan for extraction in one conditional update: sets processing, bumps attempts,
-- and returns the row, or nothing when another worker holds it or it isn't claimable.
--   explicit: uploaded, failed, or processing for over 10 minutes (a dead worker)
--   sweep:    uploaded for over 2 minutes, or processing for over 10 minutes
-- Membership and path checks happen in the app before this is called.
create function public.claim_scan(p_id uuid, p_claim text) returns setof public.scans
language sql security invoker set search_path = '' as $$
  update public.scans
     set status = 'processing', attempts = attempts + 1, error = null
   where id = p_id
     and (
       (p_claim = 'explicit' and (status in ('uploaded', 'failed')
                                  or (status = 'processing' and updated_at < now() - interval '10 minutes')))
       or
       (p_claim = 'sweep' and ((status = 'uploaded' and updated_at < now() - interval '2 minutes')
                               or (status = 'processing' and updated_at < now() - interval '10 minutes')))
     )
  returning *;
$$;

revoke execute on function public.claim_scan(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_scan(uuid, text) to service_role;
