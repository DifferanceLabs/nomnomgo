# NomNomGo

Android-first Expo MVP for planning food and activities nearby.

## What it does
- Helps users choose food, activities, or both.
- Builds a simple plan with route, share, map, favorites, saved plans, and quick add flows.
- Uses location/search-location context to bias results.
- Uses Google Places for food, places, and lower-confidence local discovery fallbacks.

## Setup
```bash
npm install
npx expo start
```

## Event Discovery Strategy
- Ticketmaster Discovery API is the primary provider for broad public event discovery in Activity > Events.
- Google Places local search is a fallback only. Event-like fallback cards must stay labeled as lower-confidence local search with dates marked "Date Not Verified".
- Do not expose Ticketmaster or Google Places production keys directly in the Expo client. Move provider calls behind the planned backend proxy before production.

## Android Production Build
```bash
npm install -g eas-cli
npx eas login
npx eas build:configure
npx eas build --platform android --profile production
```

Upload the generated `.aab` file to Google Play Console.

## Before Publishing
1. Replace app icon and splash images in `/assets` if needed.
2. Confirm the final package name in `app.json`.
3. Replace `extra.eas.projectId` after running EAS setup.
4. Test on real Android and iOS devices.
5. Create a hosted privacy policy URL.
6. Complete Google Play Data safety form.
