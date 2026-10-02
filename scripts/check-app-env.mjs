const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
const missing = required.filter(name => !process.env[name]);
if (missing.length) throw new Error(`Add these production variables in Vercel: ${missing.join(', ')}`);
const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
if (url.origin !== `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co`) {
  throw new Error('The Vercel app and GitHub migration target point at different Supabase projects. Stop and check the connection.');
}
console.log('Public app configuration matches the database migration target.');
