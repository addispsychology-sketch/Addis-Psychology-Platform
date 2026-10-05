-- Only the trusted notification queue can retune this one named job.
-- Ten-minute idle checks enter a fifteen-minute horizon before a future job
-- is due, then restore one-minute delivery checks. Newly queued jobs retune
-- immediately in the same transaction. Error/run logs remain enabled.
create function private.tune_notification_schedule() returns void
language plpgsql security definer set search_path = '' as $$
declare target_job bigint; current_schedule text; desired_schedule text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('addis-notification-schedule', 0));
  select jobid, schedule into target_job, current_schedule
    from cron.job where jobname = 'addis-notification-delivery';
  if target_job is null then return; end if;
  desired_schedule := case when exists (
    select 1 from public.notification_jobs
    where delivered_at is null and attempts < 8
      and due_at <= now() + interval '15 minutes'
      and (lease_until is null or lease_until <= now() + interval '15 minutes')
  ) then '* * * * *' else '*/10 * * * *' end;
  if current_schedule <> desired_schedule then
    perform cron.alter_job(target_job, schedule := desired_schedule);
  end if;
end $$;
revoke all on function private.tune_notification_schedule() from public, anon, authenticated;

create function private.notification_schedule_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.tune_notification_schedule();
  return null;
end $$;
revoke all on function private.notification_schedule_changed() from public, anon, authenticated;
create trigger notification_schedule_changed
after insert or delete or update of due_at, attempts, lease_until, delivered_at
on public.notification_jobs for each statement
execute function private.notification_schedule_changed();

create or replace function private.wake_notifications() returns void
language plpgsql security definer set search_path = '' as $$
declare destination text; credential text;
begin
  perform private.tune_notification_schedule();
  if not exists (
    select 1 from public.notification_jobs where delivered_at is null
      and attempts < 8 and due_at <= now()
      and (lease_until is null or lease_until < now())
  ) then return; end if;
  destination := 'https://addis-psychology-platform.vercel.app/api/jobs/notifications';
  select decrypted_secret into credential from vault.decrypted_secrets
    where name = 'addis_notification_worker_secret';
  if destination is null or credential is null then return; end if;
  perform net.http_post(url := destination,
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || credential),
    body := '{}'::jsonb, timeout_milliseconds := 60000);
end $$;
revoke all on function private.wake_notifications() from public, anon, authenticated;
select private.tune_notification_schedule();
