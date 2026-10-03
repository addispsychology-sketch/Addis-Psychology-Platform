begin;
create table public.account_status (user_id uuid primary key references auth.users(id), status text not null check(status in ('active','suspended','deleted')), updated_at timestamptz not null default now());
create table public.terms_acceptances(user_id uuid references auth.users(id), audience text check(audience in ('client','therapist')), version text not null, accepted_at timestamptz not null default now(), primary key(user_id,audience,version));
create table public.wallets(user_id uuid primary key references auth.users(id), available_cents bigint not null default 0 check(available_cents>=0));
create table public.payment_requests(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), kind text not null check(kind in ('wallet','text','voice','combined')), principal_cents bigint not null check(principal_cents between 100 and 100000000), fee_cents bigint not null check(fee_cents=ceil(principal_cents::numeric*5/100)), method text not null check(method in ('telebirr','cbe')), reference text not null check(length(reference) between 5 and 100), status text not null default 'pending' check(status in ('pending','approved','rejected')), created_at timestamptz not null default now(), reviewed_at timestamptz, reviewed_by uuid references auth.users(id), unique(method,reference));
create table public.credit_lots(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), payment_id uuid not null unique references public.payment_requests(id), texts integer not null check(texts>=0), voice_seconds integer not null check(voice_seconds>=0), initial_texts integer not null, initial_voice_seconds integer not null, principal_cents bigint not null, created_at timestamptz not null default now());
create table public.session_funds(appointment_id uuid primary key references public.appointments(id), user_id uuid not null references auth.users(id), amount_cents bigint not null check(amount_cents>=0), status text not null default 'reserved' check(status in ('reserved','released','spent')));
create table public.refund_requests(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), lot_id uuid references public.credit_lots(id), amount_cents bigint not null check(amount_cents>0), method text not null check(method in ('telebirr','cbe')), destination text not null check(length(destination) between 7 and 120), status text not null default 'requested' check(status in ('requested','paid')), requested_at timestamptz not null default now(), due_at timestamptz not null default now()+interval '24 hours', paid_at timestamptz, transfer_reference text, reviewed_by uuid references auth.users(id));
create unique index refund_transfer_reference on public.refund_requests(method,transfer_reference) where transfer_reference is not null;
create table public.wallet_ledger(id bigint generated always as identity primary key, user_id uuid not null references auth.users(id), kind text not null, amount_cents bigint not null, reference text not null unique, created_at timestamptz not null default now());
create table public.appointment_requests(id uuid primary key default gen_random_uuid(), appointment_id uuid not null references public.appointments(id), user_id uuid not null references auth.users(id), reason text not null check(length(reason) between 5 and 1000), status text not null default 'pending' check(status in ('pending','resolved')), created_at timestamptz not null default now());
create unique index one_open_appointment_request on public.appointment_requests(appointment_id) where status='pending';
create table public.conversation_reads(user_id uuid references auth.users(id) on delete cascade, conversation_id uuid references public.conversations(id) on delete cascade, read_at timestamptz not null default now(), primary key(user_id,conversation_id));
create table public.admin_audit(id bigint generated always as identity primary key, actor uuid not null references auth.users(id), action text not null, target text not null, created_at timestamptz not null default now());

do $$ declare t text; begin
 foreach t in array array['account_status','terms_acceptances','wallets','payment_requests','credit_lots','session_funds','refund_requests','wallet_ledger','appointment_requests','conversation_reads'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy own_records on public.%I for select to authenticated using (user_id=(select auth.uid()))',t);
  if t not in ('account_status','terms_acceptances','wallets','conversation_reads') then execute format('create index on public.%I(user_id)',t); end if;
 end loop;
end $$;
alter table public.admin_audit enable row level security;
revoke all on public.admin_audit from anon,authenticated;
grant all on public.admin_audit to service_role;
grant usage,select on sequence public.wallet_ledger_id_seq,public.admin_audit_id_seq to service_role;

create function private.account_active(uid uuid) returns boolean language sql stable security definer set search_path='' as $$ select not exists(select 1 from public.account_status where user_id=uid and status<>'active') $$;
revoke all on function private.account_active(uuid) from public,anon;
grant execute on function private.account_active(uuid) to authenticated,service_role;
create or replace function private.is_participant(cid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.account_active(auth.uid()) and exists(select 1 from public.conversations c join public.practitioners p on p.id=c.therapist_id where c.id=cid and (c.client_id=auth.uid() or p.user_id=auth.uid())); $$;
create policy active_conversations on public.conversations as restrictive for all to authenticated using(private.account_active((select auth.uid()))) with check(private.account_active((select auth.uid())));
create policy active_practices on public.practitioners as restrictive for all to authenticated using(private.account_active((select auth.uid()))) with check(private.account_active((select auth.uid())));
create policy active_bookings on public.appointments as restrictive for select to authenticated using(private.account_active((select auth.uid())));

create function public.review_payment(request_id uuid, actor uuid, approve boolean) returns void language plpgsql security invoker set search_path='' as $$
declare p public.payment_requests; begin
 select * into p from public.payment_requests where id=request_id for update;
 if not found or p.status<>'pending' then raise exception 'Payment already reviewed or not found'; end if;
 insert into public.wallets(user_id) values(p.user_id) on conflict do nothing;
 perform 1 from public.wallets where user_id=p.user_id for update;
 if approve then
  if p.kind='wallet' then update public.wallets set available_cents=available_cents+p.principal_cents where user_id=p.user_id;
  else insert into public.credit_lots(user_id,payment_id,texts,voice_seconds,initial_texts,initial_voice_seconds,principal_cents) values(p.user_id,p.id,case when p.kind = 'comprehensive' then 250 when p.kind in ('text','combined') then 100 else 0 end,case when p.kind = 'comprehensive' then 900 when p.kind in ('voice','combined') then 3600 else 0 end,case when p.kind = 'comprehensive' then 250 when p.kind in ('text','combined') then 100 else 0 end,case when p.kind = 'comprehensive' then 900 when p.kind in ('voice','combined') then 3600 else 0 end,p.principal_cents); end if;
  insert into public.wallet_ledger(user_id,kind,amount_cents,reference) values(p.user_id,'payment verified',p.principal_cents,'payment:'||p.id);
 end if;
 update public.payment_requests set status=case when approve then 'approved' else 'rejected' end,reviewed_at=now(),reviewed_by=actor where id=p.id;
 insert into public.admin_audit(actor,action,target) values(actor,case when approve then 'approve payment' else 'reject payment' end,p.id::text);
end $$;

create function public.reserve_session(booking_id uuid, client uuid) returns void language plpgsql security invoker set search_path='' as $$
declare a public.appointments; amount bigint; begin
 select * into a from public.appointments where id=booking_id and client_id=client for update;
 if not found or a.status not in ('pending','confirmed') or a.starts_at<=now() then raise exception 'This session cannot be funded'; end if;
 if exists(select 1 from public.session_funds where appointment_id=booking_id and status='reserved') then return; end if;
 amount:=round(a.price*100);
 insert into public.wallets(user_id) values(client) on conflict do nothing;
 update public.wallets set available_cents=available_cents-amount where user_id=client and available_cents>=amount;
 if not found then raise exception 'Add verified funds to your wallet first'; end if;
 insert into public.session_funds(appointment_id,user_id,amount_cents) values(booking_id,client,amount) on conflict(appointment_id) do update set status='reserved',amount_cents=excluded.amount_cents;
 insert into public.wallet_ledger(user_id,kind,amount_cents,reference) values(client,'session reserved',-amount,'reserve:'||booking_id);
end $$;

create function public.request_refund(client uuid, credit_id uuid, cents bigint, payout_method text, payout_destination text) returns uuid language plpgsql security invoker set search_path='' as $$
declare amount bigint; lot public.credit_lots; rid uuid; begin
 insert into public.wallets(user_id) values(client) on conflict do nothing;
 perform 1 from public.wallets where user_id=client for update;
 if credit_id is null then
  amount:=cents;
  if amount is null or amount<=0 then raise exception 'Enter a positive refund amount'; end if;
  update public.wallets set available_cents=available_cents-amount where user_id=client and available_cents>=amount;
  if not found then raise exception 'Refund exceeds available funds. Cancel eligible sessions first'; end if;
 else
  select * into lot from public.credit_lots where id=credit_id and user_id=client for update;
  if not found then raise exception 'Package not found'; end if;
  amount:=floor(lot.principal_cents::numeric * (lot.texts*150 + lot.voice_seconds*700::numeric/60) / nullif(lot.initial_texts*150 + lot.initial_voice_seconds*700::numeric/60,0));
  if amount is null or amount<=0 then raise exception 'No refundable package balance'; end if;
  update public.credit_lots set texts=0,voice_seconds=0 where id=credit_id;
 end if;
 insert into public.refund_requests(user_id,lot_id,amount_cents,method,destination) values(client,credit_id,amount,payout_method,payout_destination) returning id into rid;
 insert into public.wallet_ledger(user_id,kind,amount_cents,reference) values(client,'refund requested',-amount,'refund:'||rid);
 return rid;
end $$;

create function public.complete_refund(request_id uuid, actor uuid, bank_reference text) returns void language plpgsql security invoker set search_path='' as $$
begin
 if length(trim(bank_reference)) not between 5 and 100 then raise exception 'Enter the completed transfer reference'; end if;
 update public.refund_requests set status='paid',paid_at=now(),transfer_reference=upper(trim(bank_reference)),reviewed_by=actor where id=request_id and status='requested';
 if not found then raise exception 'Refund already completed or not found'; end if;
 insert into public.admin_audit(actor,action,target) values(actor,'refund transfer recorded',request_id::text);
end $$;

create function private.settle_session() returns trigger language plpgsql security definer set search_path='' as $$
declare f public.session_funds; begin
 if new.status=old.status then return new; end if;
 select * into f from public.session_funds where appointment_id=new.id for update;
 if not found or f.status<>'reserved' then return new; end if;
 if new.status='cancelled' then
  update public.wallets set available_cents=available_cents+f.amount_cents where user_id=f.user_id;
  update public.session_funds set status='released' where appointment_id=new.id;
  insert into public.wallet_ledger(user_id,kind,amount_cents,reference) values(f.user_id,'cancelled session released',f.amount_cents,'release:'||new.id);
 elsif new.status='completed' then update public.session_funds set status='spent' where appointment_id=new.id; end if;
 return new;
end $$;
create trigger settle_session after update of status on public.appointments for each row execute function private.settle_session();
revoke all on function private.settle_session() from public,anon,authenticated;

-- The row lock serializes message usage, refunds and payment approvals for one client.
create function private.charge_message() returns trigger language plpgsql security definer set search_path='' as $$
declare client uuid; remaining integer; lot record; used integer; begin
 select client_id into client from public.conversations where id=new.conversation_id;
 if new.sender_id<>client then return new; end if;
 if not exists(select 1 from public.terms_acceptances where user_id=client and audience='client' and version='2026-10-03') then raise exception 'Accept the client terms in Account before messaging'; end if;
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
create trigger charge_message before insert on public.messages for each row execute function private.charge_message();

alter table public.notification_jobs drop constraint notification_jobs_kind_check;
alter table public.notification_jobs add constraint notification_jobs_kind_check check(kind in ('message','appointment','reminder','payment'));
create function private.payment_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare note text; begin
 if tg_op='UPDATE' and old.status=new.status then return new; end if;
 note:=case when tg_table_name='payment_requests' then 'Payment '||new.status||'. Open your wallet for the amount, service fee and receipt.' else case when new.status='paid' then 'Your refund transfer has been recorded. Open your wallet for the receipt.' else 'Your refund request is received. Our return target is within 24 hours. The 5% service fee is non-refundable.' end end;
 insert into public.notification_jobs(recipient,channel,kind,path,summary,dedupe_key) select new.user_id,c,'payment','/wallet',note,tg_table_name||':'||new.id||':'||new.status||':'||c from unnest(array['email','telegram']) c on conflict do nothing;
 return new;
end $$;
revoke all on function private.payment_notification() from public,anon,authenticated;
create trigger payment_notice after insert or update of status on public.payment_requests for each row execute function private.payment_notification();
create trigger refund_notice after insert or update of status on public.refund_requests for each row execute function private.payment_notification();

do $$ declare f text; begin foreach f in array array['review_payment(uuid,uuid,boolean)','reserve_session(uuid,uuid)','request_refund(uuid,uuid,bigint,text,text)','complete_refund(uuid,uuid,text)'] loop
 execute 'revoke all on function public.'||f||' from public,anon,authenticated'; execute 'grant execute on function public.'||f||' to service_role'; end loop; end $$;
commit;
