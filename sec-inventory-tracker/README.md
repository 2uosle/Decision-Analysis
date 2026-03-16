# SEC Inventory Tracker (MVP)

This project now supports both:

- Local mode (browser localStorage)
- Cloud mode (Supabase)

If Supabase keys are not configured, the app automatically stays in local mode.

## Files for Supabase

- `supabase-schema.sql`: run this in Supabase SQL Editor
- `supabase-config.js`: place your project URL and anon key

## Step-by-step Supabase setup

1. Create a Supabase project.
2. Open SQL Editor in Supabase.
3. Copy all content from `supabase-schema.sql` and run it.
4. In Supabase, go to Project Settings > API.
5. Copy:
	- Project URL
	- anon public key
6. Open `supabase-config.js` and replace:
	- `YOUR_SUPABASE_PROJECT_URL`
	- `YOUR_SUPABASE_ANON_KEY`
7. Serve the app with a local HTTP server (recommended):

```powershell
cd sec-inventory-tracker
python -m http.server 5500
```

8. Open http://localhost:5500
9. Confirm header status says "Cloud sync enabled".

## What it does

- Add and update stock items
- Record stock IN, OUT, and ADJUST movements
- Track low stock based on minimum threshold
- Search inventory quickly
- Export inventory to CSV

## Current security note

The schema currently uses open RLS policies for fast MVP testing.
Before production rollout, replace policies with authenticated role-based policies.

