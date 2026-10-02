# One-time operator checklist

This is for the assistant/operator configuring the deployment, not a list of tasks the owner needs to carry out manually. The owner-facing instructions are in `START_HERE.md`.

## Account bootstrap

- Complete owner-approved account creation and establish authorized Supabase, Vercel, and Cloudflare access. Do not imply that a connector can create tokens or configure GitHub secrets unless its actual tools support those operations.
- Create a dedicated Supabase project, preserving the generated database password securely. Do not manually apply the initial SQL on a new project: the release workflow manages migration history.
- Create/import a Vercel Next.js project for this GitHub repository. Root Directory is `.` (the repository root contains package.json), production branch `master`, Node 24. A repository import may create an initial unconfigured deployment; do not treat that as live acceptance. Future automatic Git deployments are disabled by `vercel.json` in favor of the ordered workflow.
- Select the stable production HTTPS origin and use it as `APP_URL` below. If a custom domain is chosen later, update APP_URL and rerun the release.
- Enable R2 with the owner's billing approval if required. Use a dedicated private bucket, e.g. `addis-voice`. The workflow can create it, but R2 object credentials scoped to that bucket must be provisioned for the app before testing voice.

## GitHub → Settings → Secrets and variables → Actions

Store these as **secrets**, never repository files:

| Secret | Purpose |
| --- | --- |
| `VERCEL_TOKEN` | Deploy to the selected Vercel account/team |
| `SUPABASE_ACCESS_TOKEN` | Link the project; read and update auth/realtime configuration |
| `SUPABASE_DB_PASSWORD` | Apply database migrations to the selected project |
| `CLOUDFLARE_API_TOKEN` | Manage R2 buckets, inspect public access, and configure CORS in the selected account |

Use tokens restricted to the relevant project/account. Supabase scoped tokens need the CLI's Project Settings/API Keys/API Key Secrets read permissions, auth configuration read/write (including the update endpoint's project-admin permission), and realtime configuration read/write. Cloudflare's token needs the corresponding R2 storage management permissions. The app's S3 object credentials below are separate from the management API token.

Store these nonsecret **variables**:

| Variable | Value |
| --- | --- |
| `VERCEL_ORG_ID` | Team/account ID for the selected Vercel project |
| `VERCEL_PROJECT_ID` | Selected Vercel project ID |
| `SUPABASE_PROJECT_ID` | Supabase project reference, not its display name |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_BUCKET_NAME` | Dedicated private bucket name |
| `APP_URL` | Stable production HTTPS origin without a path |
| `AUTO_DEPLOY` | Leave unset until bootstrap checks are complete; then set `true` |

Optional GitHub `production` environment protection can require owner approval. The workflow only deploys `master`; pull requests have no cloud deployment credentials. Consider branch protection for that branch when collaborators are added.

## Vercel production environment variables

Set the runtime variables from `.env.example` in the selected Vercel project once. Public Supabase URL/publishable key must be available to `vercel pull` for the build. R2 and TURN secrets must remain server-only; never give them a `NEXT_PUBLIC_` prefix. Do not put Supabase management tokens or database passwords in the web app.

Configure SMTP for production email confirmation and the supported TURN relay described in `SETUP.md`. These are not automatically provisioned by the release script. It preserves existing SMTP settings and stronger password requirements.

## Enable and verify

1. Validate that Supabase public URL, migration project ID, Vercel project, R2 account/bucket, and production domain all match.
2. Set `AUTO_DEPLOY=true` and run **Check and deploy → Run workflow → master** in GitHub Actions.
3. Inspect the full result. A partial cloud-configuration failure blocks publishing. Retry after correcting permissions; migrations are tracked by Supabase, and the configuration script preserves existing redirect URLs and unrelated CORS rules.
4. The R2 bucket must have neither enabled r2.dev access nor enabled public custom domains. The script rejects a public bucket rather than changing its public-access settings. It does not read/delete voice objects.
5. Test sign-in, cross-client RLS isolation, text and voice messages, and calls across different networks. See `SETUP.md` for the acceptance checklist. Passing CI does not test real credentials, SMTP delivery, upload CORS, or TURN connectivity.

If the initial SQL was already applied manually, inspect the remote schema before reconciling migration history using the Supabase CLI. Do not reset the database or blindly mark a migration as applied. Subsequent migrations must be additive/compatible with the currently running app until the release completes.

The release workflow currently checks TypeScript, automated tests, and builds. Full lint still reports the pre-existing React-effect issues documented in SETUP.md and is not silently treated as passing.

## Sources

- [Supabase GitHub Actions migrations](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase auth configuration API](https://supabase.com/docs/reference/api/v1-update-auth-service-config)
- [Supabase realtime configuration API](https://supabase.com/docs/reference/api/v1-update-realtime-config)
- [Cloudflare R2 management API](https://developers.cloudflare.com/api/resources/r2/)
- [Vercel CLI build environment](https://vercel.com/docs/cli/pull)
- [Vercel prebuilt deployment](https://vercel.com/docs/cli/deploy)
