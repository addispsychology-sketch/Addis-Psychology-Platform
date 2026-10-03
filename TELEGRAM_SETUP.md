# Your Addis website and Telegram bot

The app uses the same private Supabase account on the website and inside Telegram. A Telegram ID typed into a form is never accepted as proof of identity.

## Your part — no coding

1. In **@BotFather**, revoke the bot token previously shared in chat. Save its replacement in the private `.env.integration.local` file beside `TELEGRAM_BOT_TOKEN=`. Never paste it into GitHub or chat.
2. Sign into **addispsychology@gmail.com**, enable Google 2-Step Verification, and open https://myaccount.google.com/apppasswords. Create an app password named “Addis website”. Save it beside `SMTP_PASSWORD=` in that same private file. This is not your normal Gmail password.
3. After the assistant publishes the site, open BotFather → your bot → **Mini Apps / Main Mini App** and use the live website URL supplied by the assistant. This makes promotion buttons open the correct Mini App.
4. In BotFather → **Login Widget**, add the live website origin under Allowed URLs. Share the displayed **Client ID** with the assistant; it is public. Do not share the client secret. The website verifies signed ID tokens and does not require that secret.
5. Open **@addispsychology_bot**, press **Start**, and send `/id`. Give the assistant your numeric ID and your official announcements channel’s @username. Add the bot to that channel with permission to post. Administrator access is only granted to IDs you explicitly identify.

If a step is confusing, stop at that screen and tell the assistant what you see. You do not need to run the technical commands below.

## Everyday use

- New clients: open Account → Continue with Telegram, or Create account with email, name, and password.
- Existing clients and therapists: sign into the existing Addis account first, then click **Connect Telegram**. This preserves existing appointments and conversations instead of creating a second account.
- Inside Telegram, returning linked users sign in automatically from Telegram’s signed launch data. Regular browsers remember a successful sign-in. Browsers cannot silently identify an arbitrary Telegram user.
- Phone sign-in: connect Telegram, send `/phone` to the bot, share **your own contact** using its button, and set a password in Account. Then use Phone number + password on either the website or Mini App. Typing a booking contact number alone does not make it a login credential.
- Email: add and confirm a real email in Account to receive session updates. Telegram-only accounts do not automatically have an email address.
- Notifications: press Start in the bot after linking. Account controls email and Telegram preferences; `/stop` pauses Telegram notifications.
- Booking: pick a slot, enter name and phone, optionally choose a language, and agree to share contact details with the therapist. A request becomes confirmed only when the therapist confirms it. No payment is collected.
- Therapists: use the portal to see client contact details and confirm/cancel appointments. Telegram chat alerts open the selected private conversation. Message contents are never included in the alert.
- Administrators: `/admin` opens the publishing studio; `/announce` starts a post; `/promote 123` selects the approved therapist whose directory ID is 123. Send text or one photo/video with a caption, choose buttons, preview, and explicitly publish. Promotions have Book and Chat buttons. Posts go to the configured official channel, not every user’s private inbox.

## Assistant / developer configuration

Read `.env.example` for setting names. Real values belong only in ignored environment files, Vercel’s server environment, and the relevant provider settings.

```
npm run setup:messaging
npm run setup:messaging -- --email
npm run setup:messaging -- --auth-email
npm run setup:messaging -- --telegram
```

`--email` checks SMTP without sending mail. `--auth-email` requires `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_ID`; it configures Supabase confirmation/recovery emails and enables phone login while keeping email confirmation on. Appointment emails use the app’s SMTP settings separately. The Gmail app password should contain no spaces in Vercel or Supabase.

Before `--telegram`, publish the app and ensure `/api/telegram/webhook` is reachable by Telegram without Vercel login protection. The route itself rejects requests without the webhook secret. The setup script refuses to replace a webhook belonging to a different URL unless the existing integration has been reviewed and `--replace-webhook` is explicitly provided. It preserves pending updates.

Set `TELEGRAM_ADMIN_IDS` to the owner-approved comma-separated numeric IDs and `TELEGRAM_ANNOUNCEMENT_CHAT_ID` to the chosen channel. Never derive admin permissions from usernames, editable profile metadata, or the first person to start the bot.

Enable the scheduled GitHub workflow only after the production endpoint works:

- Repository variable `APP_URL`: the live HTTPS origin.
- Repository secret `NOTIFICATION_JOB_SECRET`: same value as Vercel.
- Optional `VERCEL_AUTOMATION_BYPASS_SECRET` if protection remains enabled for the worker.
- Repository variable `NOTIFICATIONS_ENABLED`: `true`.

The worker runs roughly every five minutes. GitHub schedules can be delayed, so these are best-effort reminders, not emergency or exact-minute notifications. Confirmed sessions receive reminders at 24 hours and one hour when those windows are still in the future. Cancelled, completed, and already-started sessions do not receive stale reminders. Delivery retries use leases and backoff; an interrupted acknowledgement can cause an occasional duplicate. Review jobs with eight failed attempts and reset them after fixing provider configuration.

Private tables `notification_jobs`, `telegram_updates`, and `telegram_admin_drafts` intentionally have RLS with no client policies. Only server service-role access is allowed. Supabase may show informational “RLS enabled, no policy” notices for these tables.

## Before inviting clients

- Confirm signup and password recovery email arrive, using your own account.
- Link a therapist’s real account to Telegram, press Start, then check a client chat alert opens the right conversation.
- Request a session and confirm it from a different therapist account. Check both users’ alerts and reminder preferences.
- Try phone login only after contact verification and setting a password.
- Test an admin draft privately before publishing any real announcement.
- Verify ordinary users cannot open another user’s appointments, chat, or notification queue.
- Reliable calls still need TURN setup. Credit payments remain disabled until a payment provider is connected.

No fake users, sample therapists, or sample bookings are inserted by this setup.
