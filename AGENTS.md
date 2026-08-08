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

### Production Publishing Runbook

Only push directly to `main` when the user explicitly asks to publish or push to production. A push to `origin/main` triggers the Vercel production deployment.

1. Inspect `git status -sb` and preserve unrelated user-owned changes. Stage only the files in the requested release; never use `git add -A` in a mixed worktree.
2. Refresh and compare the production branch before committing:

   ```powershell
   git fetch origin main
   git rev-list --left-right --count HEAD...origin/main
   ```

   Resolve any divergence before publishing.
3. Run the release checks:

   ```powershell
   npm.cmd run verify
   npm.cmd run build:web
   npm.cmd run export:android
   npm.cmd run export:ios
   npx.cmd expo install --check
   ```

4. Commit the explicitly staged release files and push with `git push origin main`.
5. Confirm the local and remote `main` SHAs match, then monitor both the GitHub verification run and the Vercel commit status until they succeed. Do not report production as complete while either is pending.
6. Probe `https://nomnomgo.differancelabs.com` after deployment. It must respond through Vercel, and an unauthenticated request must not expose the NomNomGo application UI because the alpha launch gate remains active.

GitHub CLI is installed even when a Codex PowerShell session cannot resolve `gh` from `PATH`. Check these known locations before reporting it missing:

- `C:\Program Files\GitHub CLI\gh.exe`
- `$env:LOCALAPPDATA\Programs\GitHub CLI\gh.exe`

Use the executable by absolute path for `gh auth status`, Actions monitoring, and commit-status checks when necessary. Never print authentication tokens or secret values.

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
