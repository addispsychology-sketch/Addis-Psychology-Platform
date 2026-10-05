-- Reduce the cron and database log noise
select cron.unschedule('addis-notification-delivery');
select cron.schedule('addis-notification-delivery', '*/5 * * * *', 'select private.wake_notifications()');

-- Keep cron history small (cleanup once on migration)
delete from cron.job_run_details where end_time < now() - interval '1 day';
