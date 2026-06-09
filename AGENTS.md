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

## Independence

NomNomGo must be capable of moving to its own domain without architectural changes.

## Secrets

Never print secrets.
Never expose environment variable values.

The current public client environment variable names are:

- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
- `EXPO_PUBLIC_TICKETMASTER_API_KEY`

These are client-visible on web. Before serious public production use, provider calls should move behind an independently deployable server-side API proxy.

## Authentication

Do not depend permanently on Differance Labs authentication.

## Hosting

NomNomGo should remain deployable independently from other Differance Labs applications.
