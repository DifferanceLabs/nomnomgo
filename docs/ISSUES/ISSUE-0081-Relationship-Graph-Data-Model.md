# ISSUE-0081: Relationship Graph Data Model

- Title: Relationship Graph Data Model
- Epic: EPIC-011 Relationship Graph
- Priority: P3
- MVP: No
- Milestone: M4 - Recommendation Engine
- Story ID: RG-002

## User Story

As a group, we want group affinity so recommendations fit our actual planning behavior.

## Description

Design the first relationship graph data model for people, groups, plans, places, and shared behaviors.

## Acceptance Criteria

- Graph entities and relationships are documented.
- Model separates explicit relationships from inferred affinity.
- Data access and deletion requirements are identified.
- Recommendation use cases are mapped to graph data.

## Technical Notes

- Keep the first model queryable and explainable.
- Avoid opaque scores before transparency controls exist.

## Dependencies

- ISSUE-0039
- ISSUE-0080

## Future Considerations

- Agent and business access to graph data should require permissioned APIs.
