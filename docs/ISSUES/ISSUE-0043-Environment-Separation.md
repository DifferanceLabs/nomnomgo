# ISSUE-0043: Environment Separation

- Title: Environment Separation
- Epic: EPIC-005 Platform
- Priority: P0
- MVP: Yes
- Milestone: M1 - Local MVP
- Story ID: PF-008

## User Story

As a developer, I want environment separation so local, preview, and production are clear.

## Description

Document and enforce clear assumptions for local, Expo, preview, hosted alpha, and production environments.

## Acceptance Criteria

- Local web and mobile Expo development remain unblocked.
- Hosted web alpha gate behavior is documented and testable.
- Environment variable names are documented without values.
- Domain-specific logic stays configurable.

## Technical Notes

- Treat `DL_APP_LAUNCH_SECRET` as server-only.
- Treat `EXPO_PUBLIC_` values as client-visible.

## Dependencies

- None.

## Future Considerations

- Public launch should include provider proxy and production domain configuration checks.
