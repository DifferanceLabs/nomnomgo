# NomNomGo

NomNomGo is an independent Expo/React Native application hosted under Differance Labs.

The deployment path is:

```text
GitHub main -> Vercel -> nomnomgo.differancelabs.com
```

NomNomGo must remain capable of later moving to `nomnomgo.com` without architectural changes.

## What It Does

- Helps users choose food, activities, or both.
- Builds a simple plan with route, share, map, favorites, saved plans, and quick add flows.
- Uses location/search-location context to bias results.
- Uses Google Places for food, places, and lower-confidence local discovery fallbacks.

## Project Structure

- `App.tsx` - main Expo application.
- `app.json` - Expo app metadata, Android package, web output, splash/icon assets, and Expo plugins.
- `eas.json` - EAS Android build profiles.
- `vercel.json` - Vercel static web deployment settings.
- `assets/` - application icons, splash images, and brand assets.
- `archive/` - old app snapshots retained for reference.

## Local Development

Install dependencies:

```bash
npm install
```

Start Expo on the local network:

```bash
npm run start
```

Start Expo bound to localhost:

```bash
npm run start:localhost
```

Start Expo through a tunnel:

```bash
npm run start:tunnel
```

Start Expo for web:

```bash
npm run start:web
```

Run the Android app locally:

```bash
npm run android
```

On Windows PowerShell, if `npm` is blocked by the local execution policy, use `npm.cmd` for the same commands.

## Required Environment Variables

Create a local `.env` file in the repository root for development. Do not commit `.env` files and do not print secret values.

Required environment variable names:

- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`
- `EXPO_PUBLIC_TICKETMASTER_API_KEY`

These names are read by the Expo client. Values prefixed with `EXPO_PUBLIC_` are bundled into client builds and are client-visible. Do not place private server-side secrets in `EXPO_PUBLIC_` variables.

## Build Instructions

Android production build:

```bash
npm run build:android
```

This runs:

```bash
eas build --platform android --profile production
```

Web production build:

```bash
npm run build:web
```

This runs:

```bash
expo export -p web
```

The web build outputs static files to `dist/`.

## Deployment Instructions

### Android / EAS

1. Install dependencies with `npm install`.
2. Configure and authenticate EAS with `npx eas login`.
3. Confirm production Android settings in `app.json` and `eas.json`.
4. Configure the required environment variable names in the EAS project.
5. Build with `npm run build:android`.
6. Upload the generated Android App Bundle to Google Play Console.

### Web / Vercel

Use the Vercel project settings below:

- Framework preset: Other / no framework preset.
- Build command: `npm run build:web`
- Output directory: `dist`
- Development command: `npm run start:web`
- Root directory: repository root.

The repository includes `vercel.json` with the same build settings and an SPA rewrite to `/`.

After the first successful deployment, `nomnomgo.differancelabs.com` can be added as a custom domain in Vercel. Configure DNS according to Vercel's domain instructions. Keep domain-specific values out of app logic so the app can later move to `nomnomgo.com`.

Do not integrate Differance Labs authentication or the Differance Labs admin portal as part of this deployment path.

## Known Limitations

- The web build is a static single-page Expo app.
- Browser location support depends on browser permissions and secure-context rules. Production HTTPS hosting should support the normal permission flow; local HTTP serving may have limitations.
- Native sharing, maps links, and browser geolocation behavior depend on the user's browser and device.
- Provider API calls currently run from the client and use `EXPO_PUBLIC_` variables, which are client-visible.
- Before serious public production use, move Google Places and Ticketmaster calls behind an independently deployable server-side API proxy so provider credentials are not exposed to the web client.

## Event Discovery Strategy

- Ticketmaster Discovery API is the primary provider for broad public event discovery in Activity > Events.
- Google Places local search is a fallback only. Event-like fallback cards must stay labeled as lower-confidence local search with dates marked "Date Not Verified".
- Do not expose Ticketmaster or Google Places production keys as private secrets in the Expo client. Move provider calls behind a server-side proxy before serious public production use.

## Future Domain Migration

NomNomGo should remain independent from other Differance Labs applications so it can move from `nomnomgo.differancelabs.com` to `nomnomgo.com` without architectural changes.

To preserve that independence:

- Do not hard-code the Differance Labs subdomain into application logic.
- Keep hosting, environment variables, and backend/proxy services scoped to NomNomGo.
- Avoid permanent dependencies on Differance Labs authentication.
- Avoid coupling deployment to the Differance Labs admin portal.
- Keep CORS, redirect URLs, and callback URLs configurable when backend services are added.

## Deployment Readiness

Ready:

- Local Expo development command is defined.
- Web development command is defined.
- Web build command is defined.
- Static Vercel output is generated in `dist/`.
- Vercel deployment settings are checked in.
- Android EAS production build command is preserved.
- Required environment variable names are identifiable.
- `.env` files and generated web build output are ignored by git.

Remaining security work:

- Add an independent server-side API proxy before serious public production use if provider credentials must remain private.
