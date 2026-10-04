-- Keep messaging consent aligned with the current application terms.
create or replace function private.charge_message() returns trigger language plpgsql security definer set search_path='' as $$
declare client uuid; remaining integer; lot record; used integer; begin
 select client_id into client from public.conversations where id=new.conversation_id;
 if new.sender_id<>client then return new; end if;
 if not exists(select 1 from public.terms_acceptances where user_id=client and audience='client' and version='2026-10-03.2') then raise exception 'Accept the client terms in Account before messaging'; end if;
 insert into public.wallets(user_id) values(client) on conflict do nothing;
 perform 1 from public.wallets where user_id=client for update;
 remaining:=case when new.audio_url is null then 1 else new.duration_seconds end;
 if remaining is null or remaining<1 or remaining>86400 then raise exception 'Invalid recording duration'; end if;
 for lot in select * from public.credit_lots where user_id=client order by created_at,id for update loop
  used:=least(remaining,case when new.audio_url is null then lot.texts else lot.voice_seconds end);
  update public.credit_lots set texts=texts-case when new.audio_url is null then used else 0 end,voice_seconds=voice_seconds-case when new.audio_url is not null then used else 0 end where id=lot.id;
  remaining:=remaining-used;
  exit when remaining=0;
 end loop;
 if remaining>0 then raise exception 'Not enough verified package credit. Open Packages to add credit'; end if;
 return new;
end $$;
revoke all on function private.charge_message() from public,anon,authenticated;

alter table public.payment_requests drop constraint payment_requests_kind_check;
alter table public.payment_requests add constraint payment_requests_kind_check check(kind in ('wallet','text','voice','combined','comprehensive'));
alter table public.payment_requests add column proof_path text, add column proof_hash text;
create unique index payment_proof_hash_unique on public.payment_requests(proof_hash) where proof_hash is not null;
-- Receipt files are private; only the server can upload and issue short-lived admin links.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('payment-proofs','payment-proofs',false,3145728,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;

-- A single RLS-protected aggregate replaces one query per conversation.
create function public.unread_message_count() returns bigint language sql stable security invoker set search_path='' as $$
 select count(*) from public.messages m
 left join public.conversation_reads r on r.conversation_id=m.conversation_id and r.user_id=(select auth.uid())
 where m.sender_id<>(select auth.uid()) and m.created_at>coalesce(r.read_at,'1970-01-01'::timestamptz);
$$;
revoke all on function public.unread_message_count() from public,anon;
grant execute on function public.unread_message_count() to authenticated;
