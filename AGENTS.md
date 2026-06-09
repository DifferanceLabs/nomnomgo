## Project Purpose

NomNomGo is an independent application hosted under Differance Labs.

## Deployment

GitHub Main
→ Vercel
→ nomnomgo.differancelabs.com

Vercel settings:

- Framework preset: Other / no framework preset.
- Build command: `npm run build:web`
- Output directory: `dist`
- Development command: `npm run start:web`

## DL Alpha Launch Protection

NomNomGo web is temporarily protected by Differance Labs alpha launch auth.

This is an alpha gate, not permanent production auth.

Hosted web direct access must not show the NomNomGo app UI unless a valid launch token or NomNomGo alpha session cookie is verified.

The required server-side env var name is:

- `DL_APP_LAUNCH_SECRET`

Future production NomNomGo should own its own auth or intentionally federate with DL.

Do not break mobile/Expo development while maintaining the web gate.

## Independence

NomNomGo must be capable of moving to its own domain without architectural changes.

## Secrets

Never print secrets.
Never expose environment variable values.
Never expose `DL_APP_LAUNCH_SECRET` to the browser.

The current public client environment variable names are:

- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
- `EXPO_PUBLIC_TICKETMASTER_API_KEY`

These are client-visible on web. Before serious public production use, provider calls should move behind an independently deployable server-side API proxy.

## Authentication

Do not depend permanently on Differance Labs authentication.

## Hosting

NomNomGo should remain deployable independently from other Differance Labs applications.
