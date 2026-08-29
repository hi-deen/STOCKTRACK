---
name: account-deletion-compliance
description: Google Play account-deletion feature — URLs, support email, the two separate auth paths
metadata:
  type: project
---

Google Play data-deletion compliance for the Distro / StockTrack Mobile app (same Supabase backend as the web app). Built 2026-08-29.

- **Owner/member accounts** (Supabase `auth.users`, `@supabase/ssr` cookie session): "Delete account" section on Account → Profile page → `POST /api/account/delete` route handler → forwards session JWT to deployed `delete-account` Supabase Edge Function. 409 = sole-owner block, resolved only in the mobile app.
- **Rider accounts** (phone + PIN, `public.riders`, no `auth.users` row — completely separate): `rider_delete_account(token, pin)` Postgres RPC (migration `202608290001`, applied). Self-service on `/rider/home` menu; public no-login page at `/rider/delete-account`.
- Play Console data-deletion URL: `https://stocktrack.codegreentechnologies.ng/rider/delete-account`
- Support email for deletion requests: `support@codegreentechnologies.ng`
