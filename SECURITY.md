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
