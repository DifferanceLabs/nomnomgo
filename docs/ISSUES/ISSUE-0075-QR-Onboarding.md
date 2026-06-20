# ISSUE-0075: QR Onboarding

- Title: QR Onboarding
- Epic: EPIC-010 Growth
- Priority: P3
- MVP: No
- Milestone: M5 - Public Launch
- Story ID: GR-003

## User Story

As a user, I want QR onboarding so in-person groups can join quickly.

## Description

Generate QR codes for plans or groups so nearby participants can join without copying links.

## Acceptance Criteria

- A plan or group can display a QR code for the canonical invite link.
- QR join flow uses the same permissions and safety checks as link join.
- Expired or invalid QR links fail safely.
- QR display is readable on common mobile screens.

## Technical Notes

- Build on invite link format rather than creating a separate QR token type.
- Avoid embedding secret values in QR payloads.

## Dependencies

- ISSUE-0073
- ISSUE-0079

## Future Considerations

- Venue table QR onboarding can be explored with business partners.
