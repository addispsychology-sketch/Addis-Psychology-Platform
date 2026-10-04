alter table public.channel_posts
  add column media_path text,
  add column media_type text check (media_type in ('photo','video')),
  add column media_mime text check (media_mime in ('image/jpeg','image/png','video/mp4')),
  add column media_size bigint check (media_size > 0 and media_size <= 20971520);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('channel-media','channel-media',false,20971520,array['image/jpeg','image/png','video/mp4'])
on conflict(id) do nothing;

-- Admin-authorized signed upload tokens grant access to one object only.
-- No anonymous or authenticated Storage policies grant access to this bucket.
do $$ begin
  if exists(select 1 from storage.buckets where id='channel-media' and public) then
    raise exception 'Channel media must remain private';
  end if;
end $$;
