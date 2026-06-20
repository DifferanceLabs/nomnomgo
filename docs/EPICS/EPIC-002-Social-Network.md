# EPIC-002: Social Network

Status: Proposed

Primary phase: Phase 2, Social Planning

## Mission

Build relationships around repeated planning.

## User Outcome

Users can reconnect with people and groups they plan with, reuse social context, and build lightweight shared history without needing a generic social feed.

## Stories

| ID | Story | Priority | Acceptance Signal |
| --- | --- | --- | --- |
| SN-001 | As a user, I want friends so inviting repeat participants is faster. | Next | Users can create and view accepted friend connections. |
| SN-002 | As a user, I want friend requests so relationships require consent. | Next | Friend requests can be sent, accepted, declined, and blocked. |
| SN-003 | As a user, I want mutual friend context so I know why someone appears. | Later | Profiles show safe mutual context without exposing private data. |
| SN-004 | As a user, I want groups so recurring planning circles are easy to reuse. | Next | A group can be created from repeat participants or from scratch. |
| SN-005 | As a group member, I want group history so we remember what we did. | Next | Locked plans appear in a group history view. |
| SN-006 | As a participant, I want shared memories so prior outings feel durable. | Later | Users can attach lightweight notes or photos to completed plans. |
| SN-007 | As a group member, I want attendance tracking so recommendations reflect who actually went. | Later | Completed plans can record actual participants. |
| SN-008 | As a user, I want favorite places so good options are easy to reuse. | Next | Users can save, view, and suggest favorite places. |
| SN-009 | As a user, I want reputation signals so I trust suggestions and participants. | Later | Signals are visible, explainable, and avoid popularity-only scoring. |

## Technical Backlog

- Friend relationship model.
- Friend request lifecycle.
- Group model and group membership permissions.
- Group plan history queries.
- Saved place model.
- Attendance model.
- Privacy rules for profile, friend, and group visibility.
- Abuse controls for invitations and friend requests.

## Definition Of Done

- A returning user can start a plan with prior participants faster than a first-time plan.
- Group history and saved places influence suggestions without hiding why.
- Social features do not create public feeds or expose private planning history by default.

## Metrics

- Repeat plan rate.
- Friend request acceptance rate.
- Group reuse rate.
- Saved place reuse rate.
- Plans created from prior groups.
