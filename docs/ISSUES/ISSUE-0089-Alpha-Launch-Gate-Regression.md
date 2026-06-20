# ISSUE-0089: Alpha Launch Gate Regression

- Title: Alpha Launch Gate Regression
- Epic: EPIC-006 Reliability
- Priority: P0
- MVP: Yes
- Milestone: M2 - Private Alpha
- Story ID: RL-001A

## User Story

As an operator, I want alpha launch gate regression coverage so hosted web direct access does not expose the NomNomGo app UI.

## Description

Document and verify the temporary Differance Labs alpha launch gate behavior while keeping local web and Expo development unblocked.

## Acceptance Criteria

- Hosted web direct access without a valid launch token or alpha session shows the locked screen.
- A valid launch token creates the expected NomNomGo alpha session and removes the token from the URL.
- Localhost web and Expo mobile development bypass the gate as intended.
- Regression steps are documented without printing secret values.

## Technical Notes

- Treat `DL_APP_LAUNCH_SECRET` as server-only.
- Do not convert alpha launch auth into permanent NomNomGo product auth.

## Dependencies

- ISSUE-0043
- ISSUE-0044
- ISSUE-0046

## Future Considerations

- Public launch should replace or retire the temporary alpha gate intentionally.
