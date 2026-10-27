# Security maintenance

Production is maintained through reviewed source changes and verified deployments.

- Dependabot proposes weekly npm and GitHub Actions updates. Review major upgrades separately.
- The Security workflow scans pull requests, main-branch pushes and daily schedules. High or critical dependency findings fail visibly; known findings are not silently ignored.
- Secret scanning uses redacted output. Never publish a detected credential in an issue, log, pull request or report.
- A passing scan is evidence for its scope, not proof of complete application security. Also check authentication, authorization, database policies, provider settings and integrations.
- Test changes before deployment. Verify the deployed commit and important user flows; keep rollback instructions. Do not apply production database migrations or rotate credentials without the project's required authorization.
- Repository administrators must enable Dependabot alerts/security updates and available push protection, and require the applicable Verify/Security checks with branch rules. Workflow files alone do not enable these repository settings or gate Vercel production releases.
- If a credential is exposed, revoke or rotate it at its provider and investigate its use. Removing it from source is insufficient.
- Track unresolved findings with affected version, runtime/build exposure, mitigation, owner and review date. Do not use force upgrades merely to clear an audit count.

## October 26, 2026 release assessment

This patch incorporates production commit `1e3ba219dfc3bcf95c17193c580420a3be1276fd`, preserving its appearance and operating-hours changes. Both the appearance and HTTP security tests remain in `npm run verify`.

The locked release uses Expo 54.0.38, shell-quote 1.12.0, sharp 0.35.5 and PostCSS 8.5.31. All Metro packages are pinned to the compatible 0.83.8 patch series, which removes the old image-size dependency. Overriding image-size alone is incompatible with Metro 0.83.3's filename-based API, so that override is not used. The Expo override prevents a second SDK generation from being installed through wildcard peer dependencies. The icon package is pinned instead of using `latest`; Node 24 is declared for the host and CI.

The full locked audit remains a failing check: zero critical, 18 high and four moderate affected-package entries at review time. The high entries all propagate from one node-forge advisory; they are not 18 independent production vulnerabilities. No audit severity threshold or advisory suppression was changed.

| Remaining package | Exposure and mitigation | Follow-up |
| --- | --- | --- |
| node-forge 1.4.0, [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | Expo CLI development certificates and code-signing tooling. No published fixed version. The Vercel API imports only local modules and Node built-ins; production serves an Expo static export rather than an Expo development server. Keep development/tunnel services private and do not process untrusted signing certificates. | Mike / repository owner: review upstream and release reachability by November 2, 2026. |
| decode-uri-component 0.2.2, [GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) | Moderate malformed-URI denial of service through query-string / Expo Router. This decoder is a browser/native navigation dependency, not a Vercel API dependency. It remains an open client-side finding; the API URL resolver uses the native URL parser with a 4,096-character input limit. | Mike / repository owner: review an SDK-compatible fix by November 2, 2026. |
| uuid 3.4.0, [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Moderate buffer-boundary issue in optional-buffer v3/v5/v6 operations. Installed by the development-only ngrok package, whose source uses v4; Vercel does not run the tunnel package. | Mike / repository owner: review the tunnel dependency upgrade by November 2, 2026. |

The earlier braces advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) was withdrawn upstream on October 23, 2026; it was not locally suppressed. These findings do not justify holding the critical shell-quote patch and request-boundary hardening out of production after the release checks and artifact review pass. This is a scoped release decision, not a clean security audit.

Local release verification passed Expo's compatibility check, lint, type checking, all 149 tests, and web/Android/iOS exports. Source-map review across all three exported bundles found no node-forge, image-size, ngrok or audited uuid package sources; decode-uri-component is present, as disclosed above. Expo's separate UUID helper is not the audited ngrok dependency. Hosted CI and production deployment must still be verified for the final commit.

Before merging, run `npm ci`, `npx expo install --check`, `npm run verify`, and the web, Android and iOS exports. Verify the exact PR commit in hosted CI, including redacted secret scanning and CodeQL, and inspect the audit failure for unexpected findings. After merging, verify the merged commit's Vercel status and production response headers, anonymous account/session rejection and unsafe route-URL rejection. A successful preview deployment alone does not establish production provenance. If a release regression requires rollback, revert only this release through the same checks and verify the resulting production deployment; do not overwrite subsequent user work.
