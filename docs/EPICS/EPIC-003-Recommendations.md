# EPIC-003: Recommendations

Status: Proposed

Primary phase: Phase 3, Recommendation Intelligence

## Mission

Help groups discover experiences.

## User Outcome

Participants receive options that fit the group, the moment, the location, and the constraints well enough that they choose inside NomNomGo instead of leaving to search manually.

## Stories

| ID | Story | Priority | Acceptance Signal |
| --- | --- | --- | --- |
| RC-001 | As a participant, I want restaurant recommendations so we can find places quickly. | Now | Plan sessions can show restaurant candidates based on area and category. |
| RC-002 | As a participant, I want activity recommendations so plans are not limited to food. | Next | Activity candidates can be suggested from configured providers or curated sources. |
| RC-003 | As a participant, I want weather-aware suggestions so bad options are filtered. | Later | Outdoor suggestions account for weather when weather data is available. |
| RC-004 | As a participant, I want travel-aware suggestions so the group avoids unreasonable options. | Next | Suggestions account for location, distance, travel time, or meeting area. |
| RC-005 | As a group, we want taste profiles so recommendations fit us over time. | Later | Recommendation ranking can use explicit group preferences and prior outcomes. |
| RC-006 | As a user, I want recommendation feedback so the app learns what did and did not work. | Next | Users can explain why an option was liked, disliked, or skipped. |
| RC-007 | As a user, I want transparent explanations so I understand why options appear. | Next | Recommendation cards show reason labels such as distance, cuisine, saved place, or group fit. |
| RC-008 | As a user, I want manual override so recommendations do not trap the group. | Now | Participants can add manual suggestions even when recommendations exist. |

## Technical Backlog

- Provider abstraction for places and events.
- Recommendation candidate normalization.
- Ranking service or local ranking module.
- Feedback model.
- Preference inputs and exclusions.
- Explanation labels.
- Experiment flags for ranking changes.
- Server-side proxy plan for provider calls before public production.

## Definition Of Done

- Recommendations can be generated, explained, selected, and improved through feedback.
- Manual suggestions remain first-class.
- Sponsored or partner results are labeled before monetization experiments launch.

## Metrics

- Recommendation impression to vote rate.
- Recommendation selected as locked plan rate.
- Manual search exit rate.
- Feedback submission rate.
- Repeat recommendation satisfaction.
