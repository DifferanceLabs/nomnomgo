# EPIC-011: Relationship Graph

Status: Future

Primary phase: Phase 3 through Phase 5

## Mission

Understand how people relate to one another.

This is not MVP work. It is a long-term moat that should be developed only after the core planning loop, social planning, and reliability foundations prove useful.

## Long-Term Outcome

NomNomGo becomes the coordination layer between people, businesses, and AI assistants by understanding relationships, shared preferences, recurring patterns, and planning context.

## Stories

| ID | Story | Priority | Acceptance Signal |
| --- | --- | --- | --- |
| RG-001 | As a user, I want friend affinity so the app understands who I plan with most. | Later | The system can identify frequent planning relationships without exposing private scores. |
| RG-002 | As a group, we want group affinity so recommendations fit our actual planning behavior. | Later | Group-level patterns influence suggestions with explainable reasons. |
| RG-003 | As a user, I want shared history so past plans reduce future planning effort. | Later | Prior venues, categories, and outcomes are reusable in future plans. |
| RG-004 | As a group, we want shared preferences so suggestions reflect us together. | Later | Group preferences can combine explicit choices and completed outcomes. |
| RG-005 | As a user, I want recurring patterns so repeated plans become easier. | Later | The app can suggest repeated timing, locations, or plan templates. |
| RG-006 | As a group, we want planning predictions so likely constraints are surfaced early. | Later | The system can suggest constraints or candidates based on prior behavior with user confirmation. |
| RG-007 | As a user, I want graph transparency so I can understand and correct assumptions. | Later | Users can view, adjust, or clear important relationship and preference signals. |

## Technical Backlog

- Relationship event taxonomy.
- Relationship graph data model.
- Group affinity scoring.
- Shared preference model.
- Recurrence detection.
- Privacy controls for inferred relationships.
- Graph explanation layer.
- Data deletion and correction workflows.

## Definition Of Done

- The graph improves planning outcomes in measurable ways.
- Users can understand and control sensitive relationship-derived data.
- Agent and business features use graph context only through permissioned, auditable paths.

## Metrics

- Repeat group prediction accuracy.
- Recommendation lift from graph features.
- User correction rate for inferred preferences.
- Plan creation time reduction for recurring groups.
- Trust feedback on personalization.
