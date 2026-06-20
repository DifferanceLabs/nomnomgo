# EPIC-004: Mobile App

Status: Proposed

Primary phase: Phase 2, Social Planning

## Mission

Create a polished consumer experience.

## User Outcome

Users can plan on the device they already use for coordination, receive timely updates, open shared plans reliably, and move between maps, calendar, and communication surfaces smoothly.

## Stories

| ID | Story | Priority | Acceptance Signal |
| --- | --- | --- | --- |
| MA-001 | As a user, I want notifications so I know when a plan needs attention. | Now | Users receive plan invite, vote, changed-plan, and lock notifications with permission control. |
| MA-002 | As a user, I want deep linking so shared plans open in the right place. | Now | Plan links route to the correct plan on web and mobile where supported. |
| MA-003 | As a user, I want share sheets so I can invite through existing channels. | Now | Plans can be shared through native or web share flows. |
| MA-004 | As a user, I want calendar integration so locked plans become reminders. | Now | Locked plans can be added to the user's calendar. |
| MA-005 | As a user, I want maps integration so I can navigate to the selected place. | Now | Locked venue or suggestion cards open maps with correct destination data. |
| MA-006 | As a user, I want offline support so existing plans remain readable. | Later | Recently opened plans can be viewed with a clear offline state. |
| MA-007 | As a user, I want accessibility so planning works for more people. | Now | Core flows support readable labels, contrast, focus order, and screen sizes. |
| MA-008 | As a user, I want dark mode so the app fits mobile expectations. | Later | Core screens adapt to system or user theme without contrast regressions. |

## Technical Backlog

- Deep link routing.
- Share payload generation.
- Push notification architecture and permission UX.
- Push token registration and notification tap routing.
- Calendar export or native calendar integration.
- Optional Google Calendar write integration with explicit calendar consent.
- Maps handoff helpers.
- Offline cache strategy.
- Accessibility audit checklist.
- Responsive layout tests for key screens.

## Definition Of Done

- Users can join a shared plan from a mobile link.
- Mobile invite, vote, and lock flows are usable without desktop-only assumptions.
- Users can receive core plan notifications and add locked plans to calendar.
- Accessibility and responsive checks are part of release readiness.

## Metrics

- Invite open rate by platform.
- Push opt-in rate.
- Plan join conversion from shared links.
- Calendar export usage.
- Map handoff usage.
