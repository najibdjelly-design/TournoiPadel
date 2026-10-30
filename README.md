<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/a8245806-3992-468b-8a94-1bb4cea62655

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Import FFT / Ten'Up participants

From the registrations screen, use **Importer FFT (CSV / XLSX)** to import a CSV export or an
`.xlsx` workbook. In FFT workbooks, the `Tableau final` sheet is imported as confirmed pairs and
the `Liste d'attente` sheet as waiting-list pairs. Ranking, pair weight, and phone formatting are
preserved from the spreadsheet.

## Supabase setup

The application uses Supabase Auth and stores each account's tournaments in Supabase. Copy
`.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` to your Supabase project values. The publishable key is intended
for browser use; never put a `service_role` key in a Vite environment variable.

Apply `supabase/migrations/20261026000000_initial_schema.sql` in the Supabase SQL Editor, and
enable email/password sign-in in the Supabase Auth settings. The migration creates owner-scoped
row-level security policies and adds tournament and active-tournament state tables to Realtime.
Users sign in with the same account on each device to share its tournaments. Restart the Vite
development server after changing environment variables.

## Public participant view on Vercel

Apply `supabase/migrations/20261030000000_public_participant_shares.sql` after the initial schema.
In Vercel, configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server-side environment
variables. The service-role key must never use a `VITE_` prefix or be exposed to the browser.

From the tournament overview, create and copy the participant link. It opens a read-only page at
the same Vercel deployment. The API uses the unguessable share token to look up the tournament and
returns only confirmed pair names/clubs, pair weights, seeds, placement, schedule, scores, and pool
standings. It does not expose contact, license, payment, or other tournament administration data.
Disabling the link immediately invalidates it. The page refreshes its data every 30 seconds.
