# ISSUE-0087: Referral Program

- Title: Referral Program
- Epic: EPIC-010 Growth
- Priority: P3
- MVP: No
- Milestone: M6 - Monetization
- Story ID: GR-002

## User Story

As a user, I want a referral program so inviting people can be rewarded when appropriate.

## Description

Define and implement an abuse-resistant referral program only after invite conversion and attribution signals are reliable.

## Acceptance Criteria

- Referral attribution distinguishes inviter, invitee, plan participation, and repeat use.
- Referral rewards or benefits are documented before implementation.
- Abuse cases such as self-referral, duplicate accounts, and spam invites are addressed.
- The program can be disabled without breaking normal invite flows.

## Technical Notes

- Build on invite instrumentation and referral attribution.
- Do not add paid rewards, credits, or billing dependencies without approval.

## Dependencies

- ISSUE-0047
- ISSUE-0052
- ISSUE-0077

## Future Considerations

- Referral rewards may connect to premium planning or venue offers after monetization pilots.
