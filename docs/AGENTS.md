# NomNomGo Agent Operating Rules

These rules apply to Codex and other coding agents working on NomNomGo planning or implementation tasks.

## Work Intake

- Work from issues.
- One issue at a time.
- Confirm the relevant epic and backlog tier before implementation.
- If the issue changes product scope, update the related roadmap, epic, or backlog document in the same pull request.

## Scope Control

- Never change unrelated files.
- Prefer small pull requests.
- Keep code, tests, and docs changes focused on the issue.
- Do not refactor broad areas unless the issue explicitly requires it.

## Product Documentation

- Keep `docs/ROADMAP.md` and `docs/EPICS/` current.
- Move work between `docs/BACKLOG/NOW.md`, `docs/BACKLOG/NEXT.md`, and `docs/BACKLOG/LATER.md` when priority changes.
- Add acceptance criteria to issues before implementation starts.
- Document manual testing steps in pull requests.

## Quality

- Add tests when behavior changes.
- Run the narrowest useful verification before handing off.
- For web gate or auth changes, verify local development remains unbroken.
- For planning flows, verify create, invite, suggest, vote, and lock behaviors do not regress.

## Security And Secrets

- Do not add secrets.
- Do not add environment values.
- Never expose `DL_APP_LAUNCH_SECRET` to the browser.
- Never print secret values in logs, docs, tests, or issue comments.
- Treat `EXPO_PUBLIC_` values as client-visible.

## Platform Independence

- NomNomGo must remain independently deployable.
- Do not introduce permanent dependency on Differance Labs authentication.
- Do not hard-code Differance Labs domains into product logic unless the issue is explicitly about the temporary alpha launch gate.
- Keep future domain migration possible without architectural changes.

## Services And Cost

- Do not introduce paid services without approval.
- Prefer provider abstractions that can move behind a NomNomGo-owned server-side proxy.
- Do not add analytics or monitoring vendors without a clear product reason and approval.
