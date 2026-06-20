# EPIC-005: Platform

Status: Proposed

Primary phase: Phase 1 through Phase 5

## Mission

Provide a stable foundation for product, data, operations, and future APIs.

## User Outcome

Users can trust identity, profiles, sessions, and planning data while the team can ship safely, measure behavior, and support the product.

## Stories

| ID | Story | Priority | Acceptance Signal |
| --- | --- | --- | --- |
| PF-001 | As a user, I want authentication so my plans and relationships are protected. | Now | Users can sign in and recover access without depending permanently on Differance Labs auth. |
| PF-002 | As a user, I want a profile so participants know who is planning. | Now | Profiles include display name and safe identity fields. |
| PF-003 | As a user, I want session management so I stay signed in appropriately. | Now | Sessions persist securely and can be cleared. |
| PF-004 | As a developer, I want APIs so planning behavior can move beyond local client state. | Now | Core planning operations have defined API boundaries. |
| PF-005 | As an operator, I want admin tools so support can inspect issues safely. | Next | Authorized operators can inspect plans without exposing secrets or private data unnecessarily. |
| PF-006 | As a product owner, I want analytics so roadmap decisions use real behavior. | Now | Core funnel events are tracked with privacy-conscious event names. |
| PF-007 | As a product owner, I want feature flags so risky changes can be controlled. | Next | Features can be enabled or disabled without redeploying where practical. |
| PF-008 | As a developer, I want environment separation so local, preview, and production are clear. | Now | Config distinguishes local, preview, hosted alpha, and production assumptions. |

## Technical Backlog

- Auth architecture selection.
- User profile model.
- Session storage and invalidation.
- API routes or backend service plan.
- Data persistence model.
- Environment configuration.
- Analytics event taxonomy.
- Feature flag model.
- Admin access rules.

## Definition Of Done

- Platform choices preserve independent deployability.
- Alpha launch protection remains temporary and does not become permanent app auth.
- Core product events can be measured without collecting unnecessary sensitive data.

## Metrics

- Auth conversion.
- Session error rate.
- API error rate.
- Feature flag rollout health.
- Analytics coverage of core planning funnel.
