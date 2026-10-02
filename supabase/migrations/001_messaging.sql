-- Run once in a NEW Supabase project's SQL editor. No seed data.
begin;
create table public.practitioners (
  id bigint generated always as identity primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  profile jsonb not null,
  settings jsonb not null default '{}',
  approved boolean not null default false
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  therapist_id bigint not null references public.practitioners(id),
  unique(client_id, therapist_id)
);
create table public.practice_applications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  phone text not null,
  license text not null
);
alter table public.practice_applications enable row level security;
create policy own_application on public.practice_applications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.practice_applications from anon, authenticated;
grant select, insert, update on public.practice_applications to authenticated;
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id),
  text text,
  audio_url text,
  duration_seconds integer,
  created_at timestamptz not null default now(),
  check ((text is not null and length(trim(text)) between 1 and 2000 and audio_url is null) or (text is null and audio_url is not null)),
  check (duration_seconds is null or duration_seconds > 0)
);
create index on public.messages(conversation_id, created_at);
create index on public.conversations(therapist_id);
alter table public.practitioners enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create function public.is_participant(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.conversations c join public.practitioners p on p.id = c.therapist_id where c.id = cid and (c.client_id = auth.uid() or p.user_id = auth.uid()));
$$;
revoke all on function public.is_participant(uuid) from public;
grant execute on function public.is_participant(uuid) to authenticated;

create policy directory on public.practitioners for select using (approved or user_id = auth.uid());
create policy application on public.practitioners for insert to authenticated with check (user_id = auth.uid() and not approved);
create policy own_practice on public.practitioners for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.practitioners from anon, authenticated;
grant select on public.practitioners to anon, authenticated;
grant insert(user_id, profile, settings), update(settings) on public.practitioners to authenticated;
grant usage on sequence public.practitioners_id_seq to authenticated;

create policy own_conversations on public.conversations for select to authenticated using (public.is_participant(id));
create policy start_conversation on public.conversations for insert to authenticated with check (
  client_id = auth.uid() and exists(select 1 from public.practitioners p where p.id = therapist_id and p.approved and p.user_id <> auth.uid())
);
revoke all on public.conversations from anon, authenticated;
grant select, insert on public.conversations to authenticated;
create policy read_messages on public.messages for select to authenticated using (public.is_participant(conversation_id));
create policy send_messages on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and public.is_participant(conversation_id)
  and (audio_url is null or audio_url ~ ('^/api/voice\?key=' || conversation_id::text || '%2F' || auth.uid()::text || '%2F[a-f0-9-]{36}$'))
);
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;
grant insert(id, conversation_id, sender_id, text, audio_url, duration_seconds) on public.messages to authenticated;

-- Topic names avoid casts on untrusted topic strings.
create policy call_receive on realtime.messages for select to authenticated using (
  extension = 'broadcast' and exists(select 1 from public.conversations c where 'call:' || c.id::text = realtime.topic())
);
create policy call_send on realtime.messages for insert to authenticated with check (
  extension = 'broadcast' and exists(select 1 from public.conversations c where 'call:' || c.id::text = realtime.topic())
);
alter publication supabase_realtime add table public.messages, public.conversations;
commit;
