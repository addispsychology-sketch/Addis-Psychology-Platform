# Usage and Telegram repair — 5 October 2026

Project: `xxfajusgdrdvshvvfzhw`. Website: https://addis-psychology-platform.vercel.app.

## What generated usage

The screenshot records 0.454/5 GB uncached egress, 0.147/1 GB log ingestion, 5.837/100 GB log query, and 1,840/2,000,000 Realtime messages. These are separate meters. Log queries count bytes scanned by dashboard/API/CLI/agent log reads, rather than bytes downloaded by platform users. A daily graph and a billing-cycle total need not show the same number. The screenshot alone cannot establish why two displayed totals differ.

One diagnostic window, 4 October 23:30 to 5 October 00:30 Addis time, showed 234 production appointment reads, 157 activity requests, 122 practitioner reads, 121 message reads, about 118 conversation/read queries, and 61 reads of each of seven wallet tables. Local development also generated 116 practitioner requests. Log ingestion follows this request volume; narrowing diagnostic windows reduces log-query scans. No continuing log polling was installed.

Query statistics since 2 October confirmed thousands of repeated conversation, message, appointment, wallet, and practitioner reads. Statistics count database calls, including internal Supabase work; internal replication polling is not itself client egress. No exact billed-byte allocation by endpoint was available in the request logs.

The approved practitioner's settings contained 234,611 characters of base64 photo data. Repeated directory downloads and full practitioner Realtime rows carried that photo. Settings occupied 234,839 bytes before repair and 414 afterward, a 99.8% reduction. The image was copied unchanged to an immutable Storage URL with a one-year cache lifetime, and its SHA-256 digest verified. The original is backed up in the ignored `.env.profile-photo-backup.json` file. Only the photo field was changed, using an optimistic hash check.

## Changes

- New profile uploads use cached files; public directory responses use an anonymous-only CDN cache. Pending profiles and private account data cannot enter that shared cache.
- Practitioner Realtime rows update local availability/settings directly. Heartbeats no longer trigger another directory download.
- Message insert/edit/delete events update loaded messages directly. Reconnect and visibility recovery resynchronize history; healthy connections use a five-minute recovery check and broken connections a thirty-second check.
- Appointments use live changes with a slower fallback. Wallet responses select needed fields and use owner-filtered subscriptions. Overlapping requests are deduplicated. Read timestamps are filtered to the current user.
- Activity writes are coalesced across tabs for fifty seconds, and the client heartbeat runs once per minute. Typing/recording broadcasts share a throttle and a three-second pulse.
- Authenticated requests refresh an expired Supabase session and retry unauthorized requests once. Mini App recovery can establish a session from recent signed Telegram launch data.
- Telegram launch data is captured before app initialization and preserved across navigation/refresh. Existing signed-in Addis accounts also connect their server-verified Telegram ID; conflicting mappings are rejected. Account UI reloads after linking.
- New anonymous Telegram sign-ins require a launch less than one hour old. Already authenticated linking accepts signed launch data for a day. HMAC, duplicate-key, identity and future-clock checks remain enforced.
- Website Continue with Telegram works through an expiring, browser-bound approval in the existing bot's Mini App. It needs no separate Login Widget client ID. Requests contain no stored session tokens, have server-side creation limits, and are consumed atomically once. Users press Start in the bot, approve their own website request, then return to the original browser.

## Verification

TypeScript and the production build passed. Thirty tests passed, including database participant access, sender identity, approval privileges, booking behavior, signed Telegram forgery/expiry rejection, browser-login binding/expiry/replay rejection, and message/heartbeat updates without full reloads. Lint has no errors; seven existing warnings remain.

Live SQL confirms no inline photos remain, browser-login rows have RLS and no anon/authenticated table access, activity uses SECURITY INVOKER, and appointment Realtime publication is present. The existing profile, 45 messages, one appointment, and seven Telegram links remained intact at the migration check. Security advisors retain expected informational notices for server-only tables and pre-existing warnings for the guarded read-marker function and disabled leaked-password checks.

Existing open pages must reload once to receive the new JavaScript. Billing-cycle counters already incurred do not decrease after a fix. Future usage still depends on traffic, media downloads, diagnostics, and user activity.

Production release `dpl_2f7YunsRMu9VfY1DryB9QVu6iChd` reached READY on the existing project. Live HTTP checks measured a 1,189-byte directory response and confirmed rejected unauthenticated uploads, rejected forged Telegram launches, existing-account sign-in from a ten-minute signed launch, existing-session linking from a two-hour signed launch, cookie-bound single-use website approval, and unchanged activity timestamps for repeated heartbeats. Browser rendering of Account passed without console errors; refreshing preserved its signed-in state and displayed a connected Telegram ID. Website approval also provides an explicit Open Telegram link when a popup cannot open. The server checks use signed test launches for an already linked account; the real user's Telegram client and taps still need confirmation on their device.

Sources: [Egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress), [Log query](https://supabase.com/docs/guides/platform/manage-your-usage/logs-query), [Log ingestion](https://supabase.com/docs/guides/platform/manage-your-usage/logs-ingest), [Realtime egress](https://supabase.com/docs/guides/troubleshooting/realtime-egress-faq), [Telegram Mini App verification](https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app).
