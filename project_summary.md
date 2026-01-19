# Project Summary: Baseline (Bia Tracker)

## Overview
A personal health and productivity tracking application built with Next.js, Supabase, and Vercel.
Focuses on tracking workouts, sleep, calendar events, and other quant-self metrics.

## Operational Capabilities & Agent Skills
**Crucial:** The AI Agent has access to CLI tools and should use them for deployment and database management.

### deployment
-   **Vercel CLI**: use `npx vercel` to deploy.
    -   `npx vercel --prod` for production headers.
    -   `npx vercel env add ...` to manage secrets (especially sensitive ones like Google Credentials).
    
### database_migration
-   **Supabase CLI**: use `npx supabase` to manage the database.
    -   **Apply Migrations**: `npx supabase db push` (pushes local `supabase/migrations` to the remote linked project).
    -   **Reset/Seed**: `npx supabase db reset` (careful! data loss).
    -   *Always check status first*: `npx supabase status`.

## Architecture
-   **Frontend**: Next.js (App Router), Tailwind CSS.
-   **Backend**: Supabase (PostgreSQL, Auth, RLS).
-   **Integration**: Google Calendar (OAuth2, REST API).

## Current Status
-   **Google Calendar Sync**: Fully functional with anonymous/guest support.
-   **Deployment**: Hosted on Vercel. Credentials managed via Environment Variables.
