# Addis Psychology Platform

Next.js application with Supabase authentication and private messaging, direct Cloudflare R2 voice uploads, and WebRTC audio calls.

**Start with [START_HERE.md](START_HERE.md).** The owner only needs to establish the account connections; the assistant can handle configuration. GitHub Actions now runs the checks and ordered deployment after the one-time connections are ready.

The technical connection checklist is [deployment/CONNECTIONS.md](deployment/CONNECTIONS.md). [SETUP.md](SETUP.md) remains available as a detailed manual alternative.

```powershell
npm install
Copy-Item .env.example .env.local
# Fill the Supabase variables before testing sign-in.
npm run dev
```

Do not overwrite an existing configured `.env.local`. No cloud credentials are included. Without configuration, the app renders empty states and cannot sign in or send messages.

```powershell
npm run typecheck
npm test
npm run lint
npm run build
```

The app preserves the original UI and route structure. Demo users, seeded transcripts/bookings, simulated replies, and the browser admin password are removed. Payments, online booking, and web administration are not enabled; see SETUP.md for the exact scope and remaining live acceptance checks.
