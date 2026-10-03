begin;

create table public.account_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  telegram_notifications boolean not null default true,
  email_notifications boolean not null default true
);
alter table public.account_preferences enable row level security;
create policy own_preferences on public.account_preferences for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.account_preferences from anon, authenticated;
grant select, insert, update on public.account_preferences to authenticated;

create table public.telegram_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  telegram_id bigint not null unique check (telegram_id > 0),
  chat_id bigint unique,
  linked_at timestamptz not null default now()
);
alter table public.telegram_accounts enable row level security;
create policy own_telegram on public.telegram_accounts for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.telegram_accounts from anon, authenticated;
grant select on public.telegram_accounts to authenticated;

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id),
  therapist_id bigint not null references public.practitioners(id),
  starts_at timestamptz not null,
  medium text not null check (medium in ('online','inperson')),
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled','completed')),
  price numeric(12,2) not null check (price >= 0),
  client_name text not null check (length(client_name) between 2 and 100),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  language text not null default '' check (length(language) <= 50),
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);
create unique index appointments_therapist_slot on public.appointments(therapist_id,starts_at) where status in ('pending','confirmed');
create unique index appointments_client_slot on public.appointments(client_id,starts_at) where status in ('pending','confirmed');
create index appointments_client_history on public.appointments(client_id,starts_at);
alter table public.appointments enable row level security;
create policy participants_read_appointments on public.appointments for select to authenticated using (
  client_id = (select auth.uid()) or exists(select 1 from public.practitioners p where p.id = therapist_id and p.user_id = (select auth.uid()))
);
revoke all on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;

-- Server-only delivery queue: never expose contacts or notification payloads to clients.
create table public.notification_jobs (
  id bigint generated always as identity primary key,
  recipient uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('telegram','email')),
  kind text not null check (kind in ('message','appointment','reminder')),
  appointment_id uuid references public.appointments(id) on delete cascade,
  path text not null,
  summary text not null,
  due_at timestamptz not null default now(),
  attempts integer not null default 0,
  lease_until timestamptz,
  lease_token uuid,
  delivered_at timestamptz,
  last_error text,
  dedupe_key text not null unique
);
create index notification_due on public.notification_jobs(due_at) where delivered_at is null and attempts < 8;
create index notification_recipient on public.notification_jobs(recipient);
create index notification_appointment on public.notification_jobs(appointment_id);
alter table public.notification_jobs enable row level security;
revoke all on public.notification_jobs from anon, authenticated;

create table public.telegram_updates (
  update_id bigint primary key,
  processed_at timestamptz,
  lease_until timestamptz not null default now() + interval '2 minutes',
  lease_token uuid not null default gen_random_uuid()
);
alter table public.telegram_updates enable row level security;
revoke all on public.telegram_updates from anon, authenticated;

create table public.telegram_admin_drafts (
  telegram_id bigint primary key,
  draft jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.telegram_admin_drafts enable row level security;
revoke all on public.telegram_admin_drafts from anon, authenticated;

grant all on public.account_preferences, public.telegram_accounts, public.appointments, public.notification_jobs, public.telegram_updates, public.telegram_admin_drafts to service_role;
grant usage, select on sequence public.notification_jobs_id_seq to service_role;

-- These trigger helpers are deliberately private: a user may insert a message,
-- but only the database can derive its recipient and queue the resulting alert.
create function private.queue_message_notification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare recipient_id uuid; destination text;
begin
  select case when new.sender_id = c.client_id then p.user_id else c.client_id end,
    case when new.sender_id = c.client_id then '/portal?conversation=' || c.id::text else '/chat?therapist=' || c.therapist_id::text end
    into recipient_id, destination from public.conversations c join public.practitioners p on p.id = c.therapist_id where c.id = new.conversation_id;
  insert into public.notification_jobs(recipient,channel,kind,path,summary,dedupe_key)
    values(recipient_id,'telegram','message',destination,'You have a new private message. Open Addis to reply.','message:' || new.id::text);
  return new;
end $$;
revoke all on function private.queue_message_notification() from public, anon, authenticated;
create trigger message_notification after insert on public.messages for each row execute function private.queue_message_notification();

create function private.queue_appointment_notifications() returns trigger
language plpgsql security definer set search_path = '' as $$
declare recipient_id uuid; therapist_user uuid; delivery text; destination text; reminder_hours integer;
begin
  if tg_op = 'UPDATE' and old.status = new.status then return new; end if;
  select user_id into therapist_user from public.practitioners where id = new.therapist_id;
  foreach recipient_id in array array[new.client_id,therapist_user] loop
    destination := case when recipient_id = therapist_user then '/portal' else '/appointments' end;
    foreach delivery in array array['telegram','email'] loop
      insert into public.notification_jobs(recipient,channel,kind,appointment_id,path,summary,dedupe_key)
        values(recipient_id,delivery,'appointment',new.id,destination,'Your appointment is ' || new.status || '.','appointment:' || new.id::text || ':' || new.status || ':' || recipient_id::text || ':' || delivery)
        on conflict(dedupe_key) do nothing;
      if new.status = 'confirmed' then
        foreach reminder_hours in array array[24,1] loop
          if new.starts_at - (reminder_hours * interval '1 hour') > now() then
            insert into public.notification_jobs(recipient,channel,kind,appointment_id,path,summary,due_at,dedupe_key)
              values(recipient_id,delivery,'reminder',new.id,destination,'Reminder: you have an upcoming appointment.',new.starts_at - (reminder_hours * interval '1 hour'),'reminder:' || new.id::text || ':' || reminder_hours::text || ':' || recipient_id::text || ':' || delivery)
              on conflict(dedupe_key) do nothing;
          end if;
        end loop;
      end if;
    end loop;
  end loop;
  return new;
end $$;
revoke all on function private.queue_appointment_notifications() from public, anon, authenticated;
create trigger appointment_notification after insert or update of status on public.appointments for each row execute function private.queue_appointment_notifications();

-- Only the authenticated worker's service role can claim jobs. Leases recover crashes.
create function public.claim_notification_jobs() returns setof public.notification_jobs
language sql security invoker set search_path = '' as $$
  update public.notification_jobs j set attempts = attempts + 1, lease_until = now() + interval '5 minutes', lease_token = gen_random_uuid()
    where id in (select id from public.notification_jobs where delivered_at is null and attempts < 8 and due_at <= now() and (lease_until is null or lease_until < now()) order by due_at limit 20 for update skip locked)
    returning j.*;
$$;
revoke all on function public.claim_notification_jobs() from public, anon, authenticated;
grant execute on function public.claim_notification_jobs() to service_role;

create function public.claim_telegram_update(incoming_id bigint) returns uuid
language sql security invoker set search_path = '' as $$
  insert into public.telegram_updates(update_id) values (incoming_id)
    on conflict(update_id) do update set lease_until = now() + interval '2 minutes', lease_token = gen_random_uuid()
      where public.telegram_updates.processed_at is null and public.telegram_updates.lease_until < now()
    returning lease_token;
$$;
revoke all on function public.claim_telegram_update(bigint) from public, anon, authenticated;
grant execute on function public.claim_telegram_update(bigint) to service_role;
commit;
