-- Hosted extension API fixture; application scheduling decisions stay in migrations.
create schema cron;
create table cron.job(jobid bigint primary key, jobname text unique, schedule text);
insert into cron.job values(1, 'addis-notification-delivery', '* * * * *');
create function cron.alter_job(job_id bigint, schedule text default null,
  command text default null, database text default null,
  username text default null, active boolean default null) returns void
language sql as $$ update cron.job set schedule = $2 where jobid = $1 $$;
