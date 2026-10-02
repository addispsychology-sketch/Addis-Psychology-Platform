# Deployment setup status

Updated 2 October 2026.

## Connected and verified

- GitHub: `addispsychology-sketch/Addis-Psychology-Platform`, branch `master`.
- GitHub checks pass for the previous private-channel release. The Supabase storage update passes TypeScript and all 11 local tests; its GitHub/deployment checks must also complete.
- Supabase project: `xxfajusgdrdvshvvfzhw`. Four tracked migrations are applied, with matching migration versions.
- Messaging tables are empty. Live database access tests passed inside a rolled-back transaction.
- Supabase security advisor reported no findings after moving the participant helper into the private schema.
- Realtime allows only private channels; an anonymous public-channel probe was rejected with `PrivateOnly`.
- Email confirmation is enabled. Minimum password length was set to 12.
- The new site's `/account` callback was added without removing existing application callbacks or changing the older application's default Site URL.
- Separate Vercel project: `addis-psychology-platform`, ID `prj_GrpKWZhu22H4MqosqawYCsrTNqVt`, team `team_6ThVsldXyRXPDLjqK7oq0Ep3`.
- Production Supabase public environment variables are configured on that project. The existing `addis-psychology` Flask project was preserved.
- A protected Vercel deployment builds successfully and its account page returns HTTP 200 through authenticated verification.

## Still required before public launch

- Voice storage uses Supabase following the owner's no-card fallback preference. The `voice-notes` bucket is private, limited to 50 MB audio files, and has participant access policies. R2 remains optional and inactive. Supabase's free storage and egress quotas apply.
- TURN relay credentials for calls across restrictive networks.
- Production email delivery (custom SMTP); Supabase currently uses its default sender.
- GitHub release credentials/variables and `AUTO_DEPLOY` are not enabled. The app is linked to GitHub, but the ordered release workflow is not yet connected for automatic production publishing.
- Complete browser testing with two real accounts after email delivery is configured, including voice recording/playback and calls on separate networks.
- Remove Vercel sign-in protection only after the remaining services and verification are complete.

Protected site: https://addis-psychology-platform-addispsychology-6537s-projects.vercel.app

Do not rerun initial migrations manually or reset the database. Follow `CONNECTIONS.md` to finish the existing release setup.
