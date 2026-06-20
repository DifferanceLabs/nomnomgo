# ISSUE-0050: Incident Dashboards

- Title: Incident Dashboards
- Epic: EPIC-006 Reliability
- Priority: P3
- MVP: No
- Milestone: M5 - Public Launch
- Story ID: RL-007

## User Story

As an operator, I want incident dashboards so production issues have a single view.

## Description

Create or configure an incident dashboard that summarizes app health, planning funnel health, and provider failures.

## Acceptance Criteria

- Dashboard shows critical availability, error, and funnel signals.
- Dashboard includes invite, vote, lock, and provider failure indicators.
- Operators know where to look during incidents.
- Dashboard does not expose private user or plan content.

## Technical Notes

- Build on existing logging, monitoring, and analytics signals.
- Avoid paid tools without explicit approval.

## Dependencies

- ISSUE-0041
- ISSUE-0044
- ISSUE-0045

## Future Considerations

- Business SLA reporting should remain separate from internal incident dashboards.
