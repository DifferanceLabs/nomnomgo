# ISSUE-0078: Waitlist Flow

- Title: Waitlist Flow
- Epic: EPIC-010 Growth
- Priority: P3
- MVP: No
- Milestone: M2 - Private Alpha
- Story ID: GR-006

## User Story

As an early user, I want waitlists so access can be managed during alpha or beta.

## Description

Create a lightweight waitlist flow for users who cannot access private alpha or beta yet.

## Acceptance Criteria

- Users can submit waitlist interest without seeing the protected app UI.
- Waitlist submissions do not require secret values in the browser.
- Confirmation and duplicate states are clear.
- The flow does not replace product auth or alpha launch gating.

## Technical Notes

- Keep waitlist storage simple and independently deployable.
- Avoid coupling waitlist to Differance Labs admin portal.

## Dependencies

- ISSUE-0043
- ISSUE-0046

## Future Considerations

- Referral waitlists and invite codes can be added after alpha demand is proven.
