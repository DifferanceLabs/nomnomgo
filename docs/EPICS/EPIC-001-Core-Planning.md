# EPIC-001: Core Planning

Status: Proposed

Primary phase: Phase 1, Planning MVP

## Mission

Allow groups to decide what to do.

## User Outcome

A user can create a planning session, invite others, collect ideas, vote, and lock a final plan without relying on a separate group chat or spreadsheet.

## Stories

| ID | Story | Priority | Acceptance Signal |
| --- | --- | --- | --- |
| CP-001 | As a user, I want to create a planning session so I can organize an outing. | Now | A plan can be created with title, category, organizer, and initial state. |
| CP-002 | As a user, I want to invite friends so they can participate. | Now | Invitees can open the plan and join with a clear participant identity. |
| CP-003 | As a user, I want to define a date and time range so recommendations are relevant. | Now | A plan can store and display date, start time, end time, and flexible time notes. |
| CP-004 | As a user, I want to define where we are meeting so travel is reasonable. | Now | A plan can store a search area, location label, and radius or travel constraint. |
| CP-005 | As a participant, I want to suggest places so ideas come from everyone. | Now | Participants can add venue candidates with provider metadata or manual details. |
| CP-006 | As a participant, I want to vote so the group can reach consensus. | Now | Participants can cast, change, and remove votes while the plan is open. |
| CP-007 | As an organizer, I want to finalize the plan so everyone knows the outcome. | Now | The organizer can lock one final option and the plan state becomes final. |
| CP-008 | As a participant, I want to save the event so I remember it. | Next | A locked plan can export to calendar or create a calendar handoff. |
| CP-009 | As a participant, I want to see plan status so I know what action is needed. | Now | Plan screens show open, voting, locked, canceled, or expired states. |
| CP-010 | As an organizer, I want to reopen or cancel a plan so changes are manageable. | Next | Plans have controlled state transitions with visible history. |

## Technical Backlog

- Planning session data model.
- Participant model and permissions.
- Invite token or invite link model.
- Venue candidate model.
- Vote model and conflict rules.
- Plan state machine.
- Calendar export helper.
- Analytics events for create, invite, join, suggest, vote, and lock.
- Tests for state transitions and vote behavior.

## Definition Of Done

- Core planning loop works on local Expo and web.
- Hosted web alpha gate still prevents direct app UI access without valid access.
- Plan data can survive app reloads or server-backed persistence, depending on selected architecture.
- Manual testing steps cover at least one full multi-participant plan.

## Metrics

- Plan creation count.
- Invite acceptance rate.
- Participant count per plan.
- Suggestion count per plan.
- Vote participation rate.
- Locked plan rate.
- Time from plan creation to locked outcome.
