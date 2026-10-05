-- Hosted extension API fixture; application scheduling decisions stay in migrations.
create schema cron;
create table cron.job(jobid bigint primary key, jobname text unique, schedule text, command text);
insert into cron.job values(1, 'addis-notification-delivery', '* * * * *', 'select private.wake_notifications()');
create table cron.job_run_details(jobid bigint, end_time timestamptz);
insert into cron.job_run_details values
  (1, now() - interval '2 days'),
  (1, now() - interval '12 hours');
create function cron.schedule(job_name text, schedule text, command text) returns bigint
language plpgsql as $$
declare scheduled_job_id bigint;
begin
  insert into cron.job values(coalesce((select max(jobid) from cron.job), 0) + 1, job_name, schedule, command)
  on conflict(jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid into scheduled_job_id;
  return scheduled_job_id;
end $$;
create function cron.unschedule(job_name text) returns boolean
language plpgsql as $$
declare removed_job_id bigint;
begin
  delete from cron.job where cron.job.jobname = $1 returning jobid into removed_job_id;
  return removed_job_id is not null;
end $$;
create function cron.alter_job(job_id bigint, schedule text default null,
  command text default null, database text default null,
  username text default null, active boolean default null) returns void
language sql as $$ update cron.job set schedule = $2 where jobid = $1 $$;
