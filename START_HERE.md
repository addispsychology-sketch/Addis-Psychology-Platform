# Your part: connect the accounts once

You do not need to edit code, run terminal commands, paste SQL, or learn deployment tools.

**Current progress:** Supabase and Vercel are connected. Private Supabase storage is being used for voice notes because R2 requires a payment method. No Cloudflare subscription is active. See `deployment/STATUS.md` for the remaining launch work; you do not need to repeat account setup.

1. Create/sign in to [Supabase](https://supabase.com/dashboard) and use the Supabase connection offered in this chat.
2. Create/sign in to [Vercel](https://vercel.com/signup) and use the Vercel connection offered in this chat.
3. Tell your assistant when those connections are ready. We will handle the project configuration that those connections permit and guide you only through any owner-only approval or credential entry. Cloudflare/R2, email delivery, and reliable call relay setup come next, one at a time.

You must complete account identity verification, passwords, terms, and any billing decisions yourself. Never paste secret keys into chat or commit them to GitHub. Your assistant will identify the exact secure setting when a credential is needed.

## What GitHub will do after the one-time connection

Pushing an update to `master` runs the **Check and deploy** workflow:

1. Check types, run automated tests, and compile the app.
2. Build with the connected production Vercel settings.
3. Apply new Supabase migrations, without resetting existing records.
4. Add the app's login redirect and require private call signaling. If R2 is selected later, create its bucket if missing and configure its upload CORS rule.
5. Deploy the completed app to Vercel.

Deployment starts only after the connections are configured and `AUTO_DEPLOY` is enabled. Until then, the workflow tests the code and clearly reports that hosting is not connected. A passing check alone does **not** mean the website is live.

The Vercel Git auto-deploy shortcut is disabled in `vercel.json` so it cannot publish before the database step finishes. The GitHub workflow performs deployment instead.

## Where to see progress

Open [GitHub Actions](https://github.com/addispsychology-sketch/Addis-Psychology-Platform/actions). **Check and deploy** shows which step passed or failed. Your assistant can diagnose the result with repository access.

The original detailed manual guide is in [SETUP.md](SETUP.md) for reference. The assistant's one-time connection checklist is in [deployment/CONNECTIONS.md](deployment/CONNECTIONS.md). You do not need to follow those technical instructions yourself.

**Next: follow the assistant's next account-specific step; the existing Supabase and Vercel connections are already complete.**
