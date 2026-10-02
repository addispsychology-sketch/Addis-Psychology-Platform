# Set up your live messaging app

## Current storage choice

Voice notes now default to private **Supabase Storage** (`VOICE_STORAGE=supabase`), so Cloudflare billing is not required. Create a private `voice-notes` bucket once, with a 50 MB file limit and allowed MIME types `audio/webm`, `audio/ogg`, and `audio/mp4`. This is already done in the connected project. Apply all migrations in filename order for a new project; they include storage access policies.

Uploads go directly from the browser to storage using a signed upload token. Only an authenticated conversation participant can upload under their own user ID; playback requires a saved message visible to the requester. Supabase messages hold the protected reference, not audio bytes. Supabase upload tokens last two hours; playback links last one hour. The Free plan's 1 GB storage and separate cached/uncached egress quotas apply. There is no promise of unlimited free storage or bandwidth.

The R2 implementation remains available by setting `VOICE_STORAGE=r2` and configuring the R2 variables below. Its per-file limit remains 100 MB. Existing message references identify their storage provider, so changing the provider for new uploads does not silently redirect older recordings. Keep the original provider available to play its existing messages.

See `deployment/STATUS.md` for actual connected-service status. The R2-specific instructions below are optional for a later switch.

> **Prefer the assisted GitHub setup:** start with `START_HERE.md`. The repository now includes an ordered release workflow, so you do not need to follow this manual procedure or paste SQL yourself. The instructions below remain as a technical/manual alternative. Vercel's native Git auto-deploy is disabled in favor of the GitHub workflow; follow `deployment/CONNECTIONS.md` to enable it.

The code is prepared, but it does not create cloud accounts or deploy anything automatically. Follow these steps in order. You can complete Supabase and test text messaging before creating R2 or TURN accounts.

## What is connected

- Existing Next.js routes and CSS remain in place.
- `/account` provides email/password registration and sign-in.
- Supabase stores practice profiles, private credential applications, conversations, and messages. RLS enforces conversation membership and sender identity.
- A client starts a conversation from the therapist directory. A therapist selects that client's conversation in the portal.
- Voice recording prefers WebM/Opus at 32 kbps, with Ogg/Opus or MP4 fallback when supported. The browser uploads directly to the selected private storage provider. Supabase stores a durable protected playback URL, not audio bytes or an expiring download URL. Playback resolves to a one-hour signed URL after checking message access.
- Audio calls use private Supabase Broadcast channels and WebRTC. Both participants must be signed in with the app open. There are no background push notifications or missed-call records. An unanswered call ends after 45 seconds.
- No prepaid credit or recording-duration limit is enforced. Files are limited to 50 MB on Supabase or 100 MB on R2; recordings accumulate in browser memory. Storage, bandwidth, and service quotas still apply. Failed uploads may leave unreferenced objects; review storage usage and add an orphan cleanup job before scaling.

The old demo records and automatic replies are removed. On first load, the app removes its known legacy `addis-platform-v1` through `v4` local-storage keys; it does not clear unrelated browser storage. A fresh database has no contacts or messages.

**Not enabled:** actual payments, cloud appointment booking, and the web admin dashboard. Their existing screens remain, but fake purchases, local booking confirmations, and the demo admin password are disabled. Practice approvals use the Supabase dashboard. Saved-therapist selections are temporary in this version. These separate business flows still need implementation before you advertise them as available.

## 1. Create Supabase

1. Open [Supabase](https://supabase.com/), create an account and a new project. Keep the database password in your password manager.
2. In a new project only, run each SQL file in `supabase/migrations/` in filename order, once each. These create the tables, access policies, indexes, and Realtime publication entries without sample users. The connected project already has these migrations; do not run them again there.
3. In Realtime settings, disable **Allow public access** so private channel authorization is required. This is required for the call signaling policies. See [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization).
4. Under Authentication, enable email/password sign-in and keep email confirmation enabled. Set a minimum password length of 12.
5. Under Authentication → URL Configuration, initially set Site URL to `http://localhost:3000`. Add `http://localhost:3000/account` as an allowed redirect URL.
6. Configure custom SMTP for confirmation emails before inviting users. Supabase's default email sender is for testing and limits recipients; it is not a production email service. See [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).
7. Copy the project URL and **publishable key** from the project's API/connect settings. Do not use a service-role/secret key in this app; it does not need one.

**Next:** configure the local environment.

## 2. Run locally

Open PowerShell:

```powershell
cd "C:\Users\dawit\Desktop\Addis Psychology Platform\addis-psychology"
npm install
Copy-Item .env.example .env.local
notepad .env.local
```

Do not run the copy command over an existing configured `.env.local`. Fill these first:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Save, then run:

```powershell
npm run dev
```

Open [your account page](http://localhost:3000/account). Create and confirm an account, then sign in. If the app uses another port, also add that origin to Supabase redirects and R2 CORS. Restart `npm run dev` whenever environment variables change.

**Next:** register and approve a real practice.

## 3. Add your first therapist and test text messages

1. Sign in with the therapist's account and open `/register`.
2. Submit real practice information. License, email, and phone are in `practice_applications`, readable only by that user and the project owner through the dashboard. Public profile fields are in `practitioners`.
3. As project owner, review the application in Supabase's Table Editor. In the matching `practitioners` row, set `approved` to `true` only after reviewing the credentials. Users cannot approve themselves through the API.
4. Refresh the app. The therapist can open `/portal` and save working hours and availability. Availability is manually set, not automatic online presence.
5. Create a second account for a client in a separate browser profile or private window. In `/therapists`, open the approved therapist's chat and send a message.
6. In the therapist's portal, choose the new client conversation in the selector, then open **Live Chat Desk** and reply.
7. Refresh both browsers. Messages should persist. **Load earlier messages** increases the fetched history by 100 records across your authorized conversations.

**Next:** enable voice-note storage.

## 4. Create Cloudflare R2

1. Create a [Cloudflare](https://dash.cloudflare.com/) account and enable R2. Review any billing requirements shown by Cloudflare.
2. Create a bucket, for example `addis-voice`. Keep it **private**: do not enable public `r2.dev` access or a public custom domain.
3. Create R2 S3 API credentials with object read/write permissions scoped to this bucket. Copy the Account ID, Access Key ID, and Secret Access Key.
4. Add these to `.env.local`:

```dotenv
R2_ACCOUNT_ID=YOUR_ACCOUNT_ID
R2_ACCESS_KEY_ID=YOUR_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=YOUR_SECRET_ACCESS_KEY
R2_BUCKET_NAME=addis-voice
```

5. In the bucket's Settings → CORS policy, paste `r2-cors.json`. It initially allows `http://localhost:3000`. Browser uploads need this policy; see [Cloudflare CORS](https://developers.cloudflare.com/r2/buckets/cors/) and [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
6. Restart the local development server. In client chat, hold the microphone button to record and release to send. In the therapist portal, record, preview, and send.
7. Reload the conversation and play the note from the other account. Confirm that R2 contains the object and the Supabase `messages.audio_url` column contains only a protected `/api/voice?key=...` reference.

R2 keys remain server-side. Never prefix them with `NEXT_PUBLIC_`, paste them into source code, or commit `.env.local`. Playback links are temporary bearer URLs: anyone you deliberately share a signed link with can use it until it expires. This system does not claim end-to-end encryption.

**Next:** configure reliable calls.

## 5. Enable TURN for audio calls

Google STUN (`stun:stun.l.google.com:19302`) is already configured. It can connect some networks, but reliable calls across restrictive networks need TURN.

Use a TURN provider or coturn service that supports **TURN REST shared-secret / HMAC-SHA1 credentials**. This is separate from Cloudflare R2. The current adapter expects that credential format; a provider-specific token API needs a corresponding adapter in `app/api/calls/ice/route.ts`.

Add the provider's actual values:

```dotenv
TURN_URLS=turn:YOUR_RELAY_HOST:3478,turns:YOUR_RELAY_HOST:5349
TURN_SHARED_SECRET=YOUR_TURN_REST_SHARED_SECRET
```

Use the exact ports/transports supported by your relay, including TLS/443 if offered. The server generates one-hour temporary credentials for signed-in users; the shared secret never reaches the browser.

Restart the app. Keep both accounts open and press the phone button in chat or the selected client thread in the portal. If a conversation was just created, allow the call channel to connect and press again if prompted. Accept on the other device. Test mute, decline, hangup, microphone denial, and an unanswered call. Use headphones when testing two nearby devices.

**Next:** deploy with HTTPS; microphones on other devices do not work reliably over a plain HTTP LAN address.

## 6. Deploy from GitHub to Vercel

1. Review your local changes in GitHub Desktop or your usual Git tool, then commit and push the project. Your project already had uncommitted work before these changes; review all of it. Confirm `.env.local` is excluded. `.env.example` is safe to commit because its values are blank.
2. Create a [Vercel](https://vercel.com/) account using GitHub and import this repository. See [Git deployments](https://vercel.com/docs/git).
3. Select **Next.js**. Set Root Directory to the folder containing `package.json`: `addis-psychology` if the repository contains that parent folder, or `.` if the repository itself is already the app folder.
4. Add all populated variables from `.env.local` in Vercel's environment settings. Select Production and any Preview environment you intend to test. Public Supabase variables must be present at build time. Do not expose R2 or TURN secrets with a public prefix. See [Vercel environment variables](https://vercel.com/docs/environment-variables).
5. Deploy. Copy the resulting HTTPS domain.
6. In Supabase, change Site URL to the production HTTPS origin, and add the exact `https://YOUR_DOMAIN/account` redirect URL. Keep localhost only if you still develop locally. See [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
7. In R2 CORS, add your production origin to `AllowedOrigins`, for example `https://YOUR_DOMAIN`. Include no path or trailing slash. Add specific preview origins only if you use them.
8. If environment variables changed after deployment, redeploy. If you add a custom domain later, repeat the redirect and CORS updates.

**Next:** complete the acceptance checks before inviting live users.

## 7. Verify before launch

Local checks:

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

The automated RLS test uses local PostgreSQL via PGlite with minimal Supabase schema stubs. It checks participant access, forged senders, audio ownership, self-approval prevention, and private call-channel access. It does not replace testing your actual Supabase project. You can also run `supabase/tests/rls.sql` in the Supabase SQL Editor; it rolls back all fixtures.

Implementation verification: TypeScript and the production build passed, along with all six automated tests. The full-project lint command currently reports four existing React effect-state errors in `app/schedule/[id]/page.tsx`, `components/LoadingScreen.tsx`, `components/OnlineTherapistPopup.tsx`, and `components/Shell.tsx`, plus four warnings. Their existing UI behavior was preserved. These lint issues are separate from the new messaging/security checks and should be addressed before making lint a required deployment gate.

On the deployed site:

- Confirm signup email redirects to your production account page and sign-out hides private content.
- Use a therapist account and two different client accounts. Verify each client sees only their own conversation, and the therapist's selector keeps the threads separate.
- Try reading another client's conversation/message using that client's browser session: RLS must return no rows or reject the write. Forged sender IDs must be rejected.
- Verify a copied protected audio URL cannot be resolved by an unrelated signed-in account. An anonymous request to `/api/voice` must fail.
- Send text and voice notes in both directions; reload and test playback. Test microphone denial and a network interruption during upload; failed sends must show an error rather than success.
- Test a call across different networks (for example mobile data and Wi-Fi), including decline, unanswered timeout, mute, hangup, closing the tab, and signing out. Use browser WebRTC diagnostics to confirm a relay candidate works with TURN. A same-Wi-Fi call alone does not validate TURN.
- Review service quotas, SMTP delivery, backups, retention/deletion requirements, and failed/orphaned R2 uploads before scaling. Add application rate limits/abuse controls appropriate to your launch; authentication alone is not an upload quota.

Remaining live verification requires your accounts and credentials. No production deployment or cloud database changes were performed by this implementation.

**Your immediate next step: create the Supabase project, then run the migration from Step 1.**
